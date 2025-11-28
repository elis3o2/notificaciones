#!/usr/bin/env python3
"""
Internal aiohttp server corregido: evita llamadas síncronas al ORM desde contexto async.
"""

import os
import json
import logging
import asyncio
import signal

from decouple import config
from aiohttp import web

# Django setup
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

from src.models import Flow, MsgFlowEnv, MsgFlowRec, Nodo, Turno, TurnoFlow

# Config
HOST = "127.0.0.1"
PORT = int(config("LISTEN_PORT"))
ENDPOINT = config("API_LISTEN")
MAX_BODY_BYTES = 1_000_000
LOG_LEVEL = config("INTERNAL_SERVER_LOGLEVEL", default="INFO")

logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s [internal] %(levelname)s: %(message)s")
logger = logging.getLogger("internal_server")

async def parse_request_json(request: web.Request):
    cl = request.headers.get("Content-Length")
    if cl:
        try:
            if int(cl) > MAX_BODY_BYTES:
                raise web.HTTPRequestEntityTooLarge()
        except ValueError:
            pass
    try:
        return await request.json()
    except Exception:
        try:
            raw = await request.read()
            if raw:
                try:
                    return json.loads(raw.decode("utf-8"))
                except Exception:
                    pass
        except Exception:
            pass
        try:
            post = await request.post()
            return {k: v for k, v in post.items()}
        except Exception:
            return None

# --------- DB helpers that run in thread ----------
# Todas las llamadas ORM se ejecutan con asyncio.to_thread

async def get_or_create_flow(pk, para=None, desde=None):
    """
    Devuelve la instancia Flow existente o la crea si no existe.
    """
    def _():
        # get_or_create acepta pk como argumento con keyword `pk=...`
        flow, created = Flow.objects.get_or_create(
            pk=pk,
            defaults={
                "id_plantilla_flow_id": 1,
                "para": para,
                "desde": desde,
                "id_estado_id": 0
            },
        )
        return flow
    return await asyncio.to_thread(_)

async def set_flow_estado(pk, estado):
    def _set():
        f = Flow.objects.get(pk=pk)
        f.id_estado_id = estado
        f.save()
        return f.pk
    return await asyncio.to_thread(_set)

async def handle_finish(id_flow_pk, plantilla_name=None):
    """
    id_flow_pk: pk del Flow (string/int)
    plantilla_name: nombre del flow plantilla que querés comparar (opcional)
    """
    logger.info("handle_finish called for flow %s plantilla_name=%s", id_flow_pk, plantilla_name)

    def _():
        logger.info("ENTER _work handle_finish for %s", id_flow_pk)
        from src.models import TurnoFlow, Turno, MsgFlowEnv

        tf = TurnoFlow.objects.filter(id_flow_id=id_flow_pk).first()
        if not tf:
            logger.info("No TurnoFlow linked to flow %s", id_flow_pk)
            return {"ok": False, "reason": "no_turnoflow"}

        turno_pk = getattr(tf, "id_turno_id", None) or getattr(tf, "id_turno", None)
        if not turno_pk:
            logger.warning("TurnoFlow %s has no id_turno", tf.pk)
            return {"ok": False, "reason": "turno_missing"}

        try:
            t = Turno.objects.get(pk=turno_pk)
        except Turno.DoesNotExist:
            logger.warning("Turno %s not found for TurnoFlow %s", turno_pk, tf.pk)
            return {"ok": False, "reason": "turno_not_found"}

        if plantilla_name is not None and plantilla_name != "confirmar_turno_v1":
            logger.info("Flow plantilla %s no requiere manejo especial", plantilla_name)
            return {"ok": True, "handled": False}

        nuevo_estado_pk = None
        if MsgFlowEnv.objects.filter(id_flow_id=id_flow_pk, id_nodo_id=4).exists():
            nuevo_estado_pk = 1
        elif MsgFlowEnv.objects.filter(id_flow_id=id_flow_pk, id_nodo_id=5).exists():
            nuevo_estado_pk = 2
        elif MsgFlowEnv.objects.filter(id_flow_id=id_flow_pk, id_nodo_id=6).exists():
            nuevo_estado_pk = 3

        if nuevo_estado_pk is not None:
            t.id_estado_paciente_id = nuevo_estado_pk
            try:
                t.save(update_fields=["id_estado_paciente"])
                logger.info("Turno %s actualizado: id_estado_paciente=%s (flow %s)", t.pk, nuevo_estado_pk, id_flow_pk)
            except Exception:
                logger.exception("Fallo guardando Turno %s con update_fields, aplicando save() completo", t.pk)
                t.save()
        else:
            logger.info("No se detectaron nodos 4/5/6 para flow %s — no se actualizó Turno %s", id_flow_pk, t.pk)

        return {"ok": True}

    # **ESTA LÍNEA FALTABA**: ejecutar el trabajo en un thread para no bloquear el loop
    result = await asyncio.to_thread(_)
    logger.info("handle_finish finished for flow %s result=%s", id_flow_pk, result)
    return result


async def create_msgflowrec(id_flow_pk, fecha_hora, msg):
    """
    id_flow_pk: primary key del Flow (no instancia). Asigna al campo FK usando _id.
    """
    def _create():
        return MsgFlowRec.objects.create(id_flow_id=id_flow_pk, fecha_hora=fecha_hora, msg=msg)
    return await asyncio.to_thread(_create)

async def get_nodo_by_nombre(nombre):
    return await asyncio.to_thread(Nodo.objects.get, nombre=nombre)

async def create_msgflowenv(id_flow_pk, fecha_hora, nodo_obj):
    """
    Crea MsgFlowEnv usando id_flow_pk (clave primaria) y la instancia nodo_obj.
    nodo_obj debe ser una instancia de Nodo (obtenida con get_nodo_by_nombre).
    """
    def _create():
        return MsgFlowEnv.objects.create(id_flow_id=id_flow_pk, fecha_hora=fecha_hora, id_nodo=nodo_obj)
    return await asyncio.to_thread(_create)

# ---------------- handler ----------------
async def handler(request: web.Request):
    # check peer is localhost (extra safety)
    peer = request.transport.get_extra_info("peername")
    if peer:
        peer_ip = peer[0]
        if peer_ip not in ("127.0.0.1", "::1"):
            logger.warning("Rejected non-local request from %s", peer_ip)
            raise web.HTTPForbidden(text="Only localhost allowed")

    data = await parse_request_json(request)
    if data is None:
        logger.warning("Invalid/empty payload")
        raise web.HTTPBadRequest(text="Invalid payload")

    logger.info("Received: %s", data)

    evento = data.get("event")
    id_ = data.get("id")
    fecha_hora = data.get("time")
    message = data.get("message") or None
    node_name = data.get("nodeId") or None
    flow_name = data.get("flow") or None
    to = data.get("to")
    from_ = data.get("from")

    # Validaciones básicas
    if id_ is None:
        logger.warning("Missing id in payload")
        raise web.HTTPBadRequest(text="missing id in payload")

    try:
        # Asegura que exista el Flow (lo obtiene o lo crea) — esto corre en thread
        flow = await get_or_create_flow(id_, para=to, desde=from_)

        if evento == "flow_finished" or evento == "error":
            await set_flow_estado(id_, 1)
            logger.info("Marked flow %s as finished", id_)
            await handle_finish(id_, flow_name)
            return web.json_response({"ok": True, "action": "flow_finished", "id": id_})

        elif evento == "incoming_message":
            await create_msgflowrec(id_, fecha_hora, message)
            logger.info("Inserted incoming message for flow %s", id_)
            return web.json_response({"ok": True, "action": "incoming_message", "id": id_})

        else:
            # node event
            if not node_name:
                raise ValueError("missing node name")
            nodo_obj = await get_nodo_by_nombre(node_name)
            await create_msgflowenv(id_, fecha_hora, nodo_obj)
            logger.info("Inserted MsgFlowEnv for flow %s node %s", id_, node_name)
            return web.json_response({"ok": True, "action": "node_event", "id": id_, "node": node_name})

    except Flow.DoesNotExist:
        logger.exception("Flow not found: %s", id_)
        raise web.HTTPNotFound(text=f"Flow {id_} not found")
    except Nodo.DoesNotExist:
        logger.exception("Nodo not found: %s", node_name)
        raise web.HTTPNotFound(text=f"Nodo {node_name} not found")
    except Exception as e:
        logger.exception("Error processing payload: %s", e)
        raise web.HTTPInternalServerError(text=str(e))

# ---------------- app and runner ----------------
def create_app():
    app = web.Application(client_max_size=MAX_BODY_BYTES)
    app.router.add_post(f"/{ENDPOINT}", handler)
    async def health(request): return web.json_response({"ok": True})
    app.router.add_get("/_health", health)
    return app

async def main_async():
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()
    logger.info(f"Internal server listening on http://{HOST}:{PORT}/{ENDPOINT}")

    stop = asyncio.Event()

    def _on_signal():
        logger.info("Shutdown signal received")
        stop.set()

    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGINT, _on_signal)
    loop.add_signal_handler(signal.SIGTERM, _on_signal)

    await stop.wait()
    await runner.cleanup()

def main():
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        logger.info("Interrupted by user, exiting")

if __name__ == "__main__":
    main()
