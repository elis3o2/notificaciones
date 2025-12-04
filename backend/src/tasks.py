import pytz
from zoneinfo import ZoneInfo
from collections import defaultdict
from datetime import timedelta, datetime, date, time
from django.utils.timezone import make_aware
from celery import shared_task
from django.conf import settings
from django.db import connections, transaction, connection as default_connection
from django.db.models import OuterRef, Subquery, Exists, IntegerField, Max
from django.utils import timezone
from src.models import (Turno, Plantilla, Mensaje, LastMod,
                        EfeSerEspPlantilla, EstadoTurno, Efector, Servicio,
                        Especialidad, EfeSerEsp, Flow, TurnoFlow, PlantillaFlow)
from src.utils.utils import enviar_whatsapp, check_turno, format_plantilla, start_flow
import random
from src.utils.querys_informix import query_detalles_turno, query_efector, query_persona, query_turnos_historico
from src.utils.parse import parse_date, parse_time
from src.utils.utils import create_Turno, update_estado_Turno, create_Mensaje
from rest_framework.response import Response

TZ = ZoneInfo("America/Argentina/Buenos_Aires")



@shared_task
def verificar_turnos():
    print(f"[{timezone.now()}] Ejecutando verificación de turnos...")
    
    # Obtener/crear LastMod (mantener aware si USE_TZ)
    try:
        last_mod_obj = LastMod.objects.first()
        if last_mod_obj: 
            last_mod_raw = last_mod_obj.fecha
        else:
            return
    except Exception as e:
        print(f"[ERROR] al obtener/crear LastMod: {e}")
        return

    try:
        conn = connections['informix']
        with conn.cursor() as cur:
            lm_param = last_mod_raw.strftime("%Y-%m-%d %H:%M:%S")
            print(f"[DEBUG] Usando last_mod para consulta Informix: {lm_param!r}")

            try:
                cur.execute(query_turnos_historico(), [lm_param])
           
            except Exception as ex:
                print(f"[ERROR] al ejecutar consulta de notificaciones con param {lm_param!r}: {ex}")
                return

            mejor_raw = None

            for r in cur.fetchall():
                print(f"[DEBUG] notificacion raw: {r}")
                idturno, idpaciente, idestadoturno, last_modf_val = r

                este_raw = str(last_modf_val).split(".")[0]
                if mejor_raw is None or este_raw > mejor_raw:
                    mejor_raw = este_raw

                # Mapeo de idestadoturno -> estado (restaurado al mapping esperado)
                if idestadoturno == 3:
                    estado = 1
                elif idestadoturno in (4, 5, 6):
                    estado = 4
                elif idestadoturno in (1, 2, 7):
                    estado = 2
                elif idestadoturno == 8:
                    estado = 3
                else:
                    continue

                # Inicializo variables que luego uso (mínimo)
                id_efe_ser_esp = None
                id_efector = id_servicio = id_especialidad = None
                nombre_servicio = nombre_especialidad = nombre_efector = None
                calle = altura = letra = coordx = coordy = tel_efe = calle_nom = None
                carac_tel = tel = nom_pac = ape_pac = nom_prof = ape_prof = None
                d_fecha = d_hora = None

                # Si corresponde (0 o 3) traigo detalles completos
                detalles = None
                if estado in (1, 3):
                    try:
                        cur.execute(query_detalles_turno(1), [idturno])
                        detalles = cur.fetchone()
                    
                    except Exception as ex:
                        print(f"[ERROR] al ejecutar make_query() para idturno={idturno}: {ex}")
                        continue

                    if not detalles:
                        print(f"[DEBUG] No hay detalles para idturno={idturno}")
                        continue

                    (
                        _id_from_row, id_efector, id_servicio, id_especialidad, id_efe_ser_esp ,
                        tipo_doc, nro_doc, ape_pac, nom_pac, fecha_turno, hora_turno,
                        ape_prof, nom_prof, nombre_servicio, nombre_especialidad,
                        nombre_efector, calle, altura, letra, coordx, coordy,
                        tel_efe, calle_nom, carac_tel, tel
                    ) = detalles
                    # parsear
                    d_fecha = parse_date(fecha_turno)
                    d_hora = parse_time(hora_turno)

                    fecha = d_fecha.strftime("%d-%m-%Y")
                    hora = d_hora.strftime("%H:%M")


                    if estado == 1:
                        try:
                            t = create_Turno(idturno, idpaciente,estado,
                                id_efe_ser_esp, d_fecha, d_hora)
                            
                            print(f"[INFO] Creado Turno id={idturno} fecha={fecha} hora={hora}")
                        except Exception as ex:
                            print(f"[ERROR] al crear Turno id={idturno}: {ex}")
                            continue

                if estado in (2, 3, 4):
                    t = update_estado_Turno(idturno, idpaciente, estado)
                    
                    if t == None:
                        continue
                    # Si estado == 2 (suspendido) 
                    if estado == 2:
                            
                        try:
                            # obtener datos persona de forma segura
                            cur.execute(query_persona(), [idpaciente])
                            persona_row = cur.fetchone()
                            if persona_row:
                                ape_pac, nom_pac, carac_tel, tel = persona_row
                            else:
                                ape_pac = nom_pac = carac_tel = tel = None

                            # --- cambio mínimo: obtener id_efe_ser_esp desde Turno si no lo tenemos
                            id_efe_ser_esp = getattr(t, "id_efe_ser_esp_id", id_efe_ser_esp)

                            # obtener EfeSerEsp para sacar efector/servicio/especialidad (asumimos que existe)
                            ese_obj = EfeSerEsp.objects.select_related(
                                    "id_efector", "id_servicio", "id_especialidad"
                                ).get(pk=id_efe_ser_esp)


                            
                            id_efector = ese_obj.id_efector
                            id_servicio = ese_obj.id_servicio_id
                            id_especialidad = ese_obj.id_especialidad_id

                            nombre_servicio = ese_obj.id_servicio_nombre 
                            nombre_especialidad = ese_obj.id_especialidad_nombre 
                            # datos del efector vía cursor Informix
                            nombre_efector = calle = altura = letra = coordx = coordy = tel_efe = calle_nom = None
                            
                            cur.execute(query_efector(), [id_efector])
                            ef_row = cur.fetchone()
                            if ef_row:
                                (nombre_efector, calle, altura, letra,
                                coordx, coordy, tel_efe, calle_nom) = ef_row

                            # obtener fecha/hora guardadas en Turno (siempre strings según create)
                            fecha = getattr(t, "fecha", None)
                            hora = getattr(t, "hora", None)

                            # intentar parsear sin hacer chequeos extra (cambio mínimo)

                            d_fecha = parse_date(fecha).strftime("%d-%m-%Y")
                            
                            d_hora = parse_time(hora).strftime("%H:%M")


                            nom_prof = None
                            ape_prof = None
                        except Exception as ex:
                            print(f"[ERROR] al procesar estado 2 para idturno={idturno}: {ex}")
                            continue

                if estado == 4:
                    continue

                telefono = None
                send, plantilla = check_turno(id_efe_ser_esp, estado)
                if send and plantilla:
                    if carac_tel and tel:
                        telefono = ("549" + str(carac_tel) + str(tel)).replace(" ", "")

                        datos_plantilla = {
                            "nompac": nom_pac or "",
                            "apepac": ape_pac or "",
                            "fecha": d_fecha,
                            "horaturno": d_hora,
                            "nomprof": nom_prof or "",
                            "apeprof": ape_prof or "",
                            "especialidad": nombre_especialidad or "",
                            "efector": nombre_efector or "",
                            "servicio": nombre_servicio or "",
                            "calle": calle or "",
                            "altura": altura or "",
                            "letra": letra or "",
                            "coordx": coordx or "",
                            "coordy": coordy or "",
                            "tel_efe": tel_efe or "",
                            "calle_nom": calle_nom or "",
                        }

                        mensaje = format_plantilla(plantilla.contenido, datos_plantilla)
                        res = enviar_whatsapp(telefono, mensaje)
                        response_data = getattr(res, "data", {})

                        ack = decode_res(res)
                        
                        id_mensaje=response_data.get("id", None)
                        try:
                            create_Mensaje(id_mensaje,t, telefono, plantilla, ack)
                        
                        except Exception as ex:
                            print(f"[ERROR] al crear Mensaje para turno {idturno}: {ex}")
                            continue

                        if ack >= 0:  # actualizar flags en Turno
                            try:
                                if estado == 1:
                                    t.msj_confirmado = 1
                                    t.save(update_fields=["msj_confirmado"])
                                elif estado == 2:
                                    t.msj_cancelado = 1
                                    t.save(update_fields=["msj_cancelado"])
                                elif estado == 3:
                                    t.msj_reprogramado = 1
                                    t.save(update_fields=["msj_reprogramado"])
                            except Exception as ex:
                                print(f"[ERROR] al actualizar flags msj_* en Turno id={idturno}: {ex}")
                    
                    else:
                        print(f"[DEBUG] No hay teléfono válido para idturno={idturno} (carac_tel={carac_tel}, tel={tel})")
                        try:
                            create_Mensaje(turno=t, plantilla=plantilla, estado=-3)

                        except Exception as ex:
                            print(f"[ERROR] al crear Mensaje para turno {idturno}: {ex}")
                else:
                    print(f"[DEBUG] check_turno returned send={send}, plantilla={plantilla} for turno {idturno}")

            # Al final: actualizar LastMod con mejor_raw EXACTO (SQL directo en default_connection)
            try:
                if mejor_raw is None:
                    print("[DEBUG] No se encontró mejor_raw -> no se actualiza LastMod")
                else:
                    
                    last_mod_obj.fecha = mejor_raw
                    last_mod_obj.save(update_fields=['fecha'])

                    print(f"[DEBUG] Actualizado LastMod.fecha = {last_mod_obj.fecha}")
            except Exception as ex:
                print(f"[ERROR] al actualizar LastMod con SQL directo: {ex}")

    except Exception as e:
        print(f"[ERROR] Error en verificación de turnos: {e}")






def decode_res(res: Response) -> int:
    # 1. match reemplaza al switch/case de otros lenguajes
    match res.status_code:
        case 503:
            ack = -5
        case 400:
            ack = -4
        case 404:
            ack = -3
        case 422:
            ack = -2
        case 500:
            ack = -1
        case _:  
            response_data = getattr(res, "data", {})
            ack = int(response_data.get("ack", -5)) 

    return ack



@shared_task
def programar_recordatorios():
    print(f"[{timezone.now().isoformat()}] Ejecutando recordatorios...")        

    try:
        hoy = datetime.now().date()

        efp_qs = (
            EfeSerEspPlantilla.objects
            .filter(
                id_efe_ser_esp=OuterRef('id_efe_ser_esp'),
                recordatorio=1
            )
        )

        rango_fin = hoy + timedelta(days=5)

        turnos_qs = (
            Turno.objects
            .filter(id_estado=1, msj_recordatorio=0, fecha__range=(hoy, rango_fin))
            .annotate(
                efp_exists=Exists(efp_qs),
                plantilla_reco=Subquery(efp_qs.values('plantilla_reco')[:1]),
                dias_antes=Subquery(efp_qs.values('dias_antes')[:1]),
            )
            .filter(efp_exists=True)
            .order_by('fecha', 'hora')
            .values('id','id_sisr', 'id_efe_ser_esp',
                    'fecha', 'hora', 'dias_antes', 'plantilla_reco')
        )

        turnos = list(turnos_qs)
        if not turnos:
            print("No hay turnos candidatos para recordatorios.")
            return

        # Filtrar los que realmente correspondan: fecha - dias_antes == hoy
        candidatos = []
        for t in turnos:
            fecha: date = t['fecha']
            dias_antes = int(t['dias_antes'] or 0)
            if fecha - timedelta(days=dias_antes) == hoy:
                candidatos.append(t)

        if not candidatos:
            print("Ningún turno requiere recordatorio hoy.")
            return

        turnos_ids = [t['id_sisr'] for t in candidatos]
        turnos_map = {t["id_sisr"]: t for t in candidatos}

        conn = connections['informix']
        resultados = []
        if turnos_ids:
            with conn.cursor() as cur:
                cur.execute(query_detalles_turno(len(turnos_ids)), turnos_ids)
                resultados = cur.fetchall()

        if not resultados:
            print("No se obtuvieron resultados desde Informix para los turnos solicitados.")
            return

        # distribuimos envíos para turnos en días futuros: evitar picos
        per_day_counter = defaultdict(int)
        per_day_batches = {}  # nuevo: guarda offsets por (target_date, batch_index)
        tz = timezone.get_current_timezone()

        # parámetros de batching
        batch_size = 5
        batch_window_seconds = 180  # 3 minutos = 180s

        for r in resultados:
            try:
                (
                    id_turno ,id_efector, id_servicio, id_especialidad,
                    id_efe_ser_esp, tipo_doc, nro_doc,
                    ape_pac, nom_pac, fecha_turno_inf, hora_turno_inf,
                    ape_prof, nom_prof, nombre_servicio, nombre_especialidad,
                    nombre_efector, calle, altura, letra, coordx, coordy,
                    tel_efe, calle_nom, carac_tel, tel
                ) = r
            except Exception as ex:
                print(f"[WARN] Tuple de resultados con longitud inesperada: {ex} -> {r}")
                continue

            t_local = turnos_map.get(id_turno)
            if not t_local:
                print(f"[WARN] No se encontró turno local para id_turno={id_turno}")
                continue

            fecha_turno = t_local["fecha"]            # fecha del turno
            hora_turno = t_local["hora"]              # hora del turno
            dias_antes = int(t_local.get("dias_antes") or 0)

            # fecha objetivo para el envío (la que determinó el candidato)
            target_date = fecha_turno - timedelta(days=dias_antes)

            # construir send_dt de forma robusta
            # si el recordatorio es para el mismo día del turno (dias_antes == 0),
            # aplicamos las reglas por hora; si no, programamos sobre target_date (ej. 12:50)
            if dias_antes == 0:
                dt_naive = datetime.combine(fecha_turno, hora_turno)
                try:
                    send_dt = make_aware(dt_naive, tz)
                except Exception as ex:
                    try:
                        send_dt = dt_naive.replace(tzinfo=tz)
                    except Exception as ex2:
                        print(f"[ERROR] No se pudo crear send_dt aware para id_turno={id_turno}: {ex} / {ex2}")
                        continue

                if fecha_turno == hoy:
                    if hora_turno <= time(10, 30):
                        send_dt = send_dt - timedelta(hours=2)
                    elif hora_turno <= time(13, 0):
                        send_dt = send_dt - timedelta(hours=3)
                    else:
                        send_dt = send_dt - timedelta(hours=4)
                else:
                    # si dias_antes == 0 pero fecha_turno > hoy (raro), colocamos envío a la base y escalonamos
                    base_naive = datetime.combine(fecha_turno, time(11, 56))
                    try:
                        base = make_aware(base_naive, tz)
                    except Exception:
                        try:
                            base = base_naive.replace(tzinfo=tz)
                        except Exception:
                            print(f"[ERROR] No se pudo crear base aware para id_turno={id_turno}")
                            continue

                    idx = per_day_counter[target_date]
                    # cálculo de batching: batch index y posición dentro del batch
                    batch_index = idx // batch_size
                    pos_in_batch = idx % batch_size
                    batch_key = (target_date, batch_index)

                    # generar offsets aleatorios ordenados para el batch si no existen
                    if batch_key not in per_day_batches:
                        try:
                            offsets = sorted(random.sample(range(batch_window_seconds), k=batch_size))
                        except ValueError:
                            # fallback en caso raro
                            offsets = sorted(random.randint(0, batch_window_seconds - 1) for _ in range(batch_size))
                        per_day_batches[batch_key] = offsets

                    offsets = per_day_batches[batch_key]
                    offset = offsets[pos_in_batch]

                    # send_dt: base + (batch_index * batch_window_seconds) + offset_in_batch
                    send_dt = base + timedelta(seconds=(batch_index * batch_window_seconds + offset))

                    per_day_counter[target_date] += 1

            else:
                # dias_antes > 0 -> programar en target_date a la base (12:50) y escalonar con batching
                base_naive = datetime.combine(target_date, time(11, 56))
                try:
                    base = make_aware(base_naive, tz)
                except Exception:
                    try:
                        base = base_naive.replace(tzinfo=tz)
                    except Exception:
                        print(f"[ERROR] No se pudo crear base aware para id_turno={id_turno}")
                        continue

                idx = per_day_counter[target_date]
                # cálculo de batching: batch index y posición dentro del batch
                batch_index = idx // batch_size
                pos_in_batch = idx % batch_size
                batch_key = (target_date, batch_index)

                # generar offsets aleatorios ordenados para el batch si no existen
                if batch_key not in per_day_batches:
                    try:
                        offsets = sorted(random.sample(range(batch_window_seconds), k=batch_size))
                    except ValueError:
                        offsets = sorted(random.randint(0, batch_window_seconds - 1) for _ in range(batch_size))
                    per_day_batches[batch_key] = offsets

                offsets = per_day_batches[batch_key]
                offset = offsets[pos_in_batch]

                send_dt = base + timedelta(seconds=(batch_index * batch_window_seconds + offset))

                per_day_counter[target_date] += 1

            # comparar con now aware (y debug si algo raro pasa)
            now = timezone.now()
            if getattr(now, "tzinfo", None) is None:
                try:
                    now = make_aware(now, tz)
                except Exception:
                    pass

            if send_dt <= now:
                eta = now + timedelta(seconds=5)
            else:
                eta = send_dt
            try:
                send_reminder_task.apply_async(args=(list(map(str, r)),), eta=eta)
                print(f"Programado reminder para id_turno={id_turno} en {eta.isoformat()}")
            except Exception as ex:
                print(f"[ERROR] al programar send_reminder_task para id_turno={id_turno}: {ex}")

        print("Procesamiento de recordatorios completado")

    except Exception as e:
        print(f"Error en recordatorios: {str(e)}")


# Usa bind=True para poder llamar self.retry()
@shared_task(bind=True, max_retries=5, default_retry_delay=3600)
def send_reminder_task(self, detalles):
    """
    detalles: tupla que devuelve make_query (ver SELECT antes)
    """
    # seguridad: inicializar ack
    ack = None

    try:
        (
            id_turno,
            id_efector, id_servicio, id_especialidad,
            id_efe_ser_esp, tipo_doc, nro_doc,
            ape_pac, nom_pac, fecha_turno, hora_turno,
            ape_prof, nom_prof, nombre_servicio, nombre_especialidad,
            nombre_efector, calle, altura, letra, coordx, coordy,
            tel_efe, calle_nom, carac_tel, tel
        ) = detalles
    except Exception as ex:
        print(f"[ERROR] detalles inválidos para turno: {ex}")
        return

    need_retry = False  # bandera para reintentar después del commit

    try:
        with transaction.atomic():
            # 🔒 LOCK del turno (FOR UPDATE)
            turno = (
                Turno.objects
                .select_for_update()
                .filter(id_sisr=id_turno)
                .first()
            )

            if not turno:
                print(f"[WARN] Turno {id_turno} no existe.")
                return

            # Si el turno cambió de estado o ya tiene recordatorio, no enviamos
            if turno.id_estado_id != 1 or turno.msj_recordatorio == 1:
                print(f"Cambio de estado o ya enviado para turno {id_turno}, abortando envío.")
                return

            # comprobar si aún corresponde (ej: chequeos de configuración dinámica)
            send_flag, plantilla = check_turno(id_efe_ser_esp, 4)
            if not send_flag or not plantilla:
                print(f"[DEBUG] check_turno returned send={send_flag}, plantilla={plantilla} for turno {id_turno}")
                return

            # validar teléfono
            if not carac_tel or not tel:
                print(f"[DEBUG] No hay teléfono válido para id_turno={id_turno} (carac={carac_tel}, tel={tel})")
                try:
                    create_Mensaje(turno=turno, plantilla=plantilla, estado=-3)
                except Exception as ex:
                    print(f"[ERROR] al crear Mensaje para turno {id_turno}: {ex}")
                return

            telefono = ("549" + str(carac_tel) + str(tel)).replace(" ", "")

            # Si existe algun TurnoFlow con Flow en estado 0, marcamos reintento
            if Flow.objects.filter(para=telefono, id_estado_id=0).exists():
                print(f"[INFO] Existe TurnoFlow con Flow abierto {id_turno}, reintentando luego.")
                need_retry = True
            else:
            
                # parsear fecha/hora con seguridad

                d_fecha = parse_date(fecha_turno)
                d_hora = parse_time(hora_turno)
                d_fecha_str = d_fecha.strftime("%d-%m-%Y")
                d_hora_str = d_hora.strftime("%H:%M")

                datos_plantilla = {
                    "nompac": nom_pac or "",
                    "apepac": ape_pac or "",
                    "fecha": d_fecha_str,
                    "horaturno": d_hora_str,
                    "nomprof": nom_prof or "",
                    "apeprof": ape_prof or "",
                    "especialidad": nombre_especialidad or "",
                    "efector": nombre_efector or "",
                    "nombre_servicio": nombre_servicio or "",
                    "calle": calle or "",
                    "altura": altura or "",
                    "letra": letra or "",
                    "coordx": coordx or "",
                    "coordy": coordy or "",
                    "tel_efe": tel_efe or "",
                    "calle_nom": calle_nom or "",
                }

                mensaje = format_plantilla(plantilla.contenido, datos_plantilla)

                # enviar_whatsapp puede devolver distintos tipos; proteger acceso
                try:
                    res = enviar_whatsapp(telefono, mensaje)
                except Exception as ex:
                    print(f"[ERROR] enviar_whatsapp falló para turno {id_turno}: {ex}")
                    # si querés reintentar por fallo transitorio, podés usar self.retry(exc=ex)
                    raise

                

                ack = decode_res(res) 
                response_data = getattr(res, "data", {})
                
                try:
                    id_mensaje=response_data.get("id", None)
                    create_Mensaje(id_mensaje, turno, telefono, plantilla, ack)

                except Exception as ex:
                    print(f"[ERROR] al crear Mensaje para turno {id_turno}: {ex}")
                    return

                if ack >= 0:
                    turno.msj_recordatorio = 1
                    turno.save(update_fields=["msj_recordatorio"])

        if ack >= 0 and not need_retry:
            try:
                res = start_flow(telefono, "confirmacion-turno")
            except Exception as ex:
                print(f"[ERROR] start_flow falla para turno {id_turno}: {ex}")
                return

            status_code = getattr(res, "status_code", None)
            body = getattr(res, "data", {}) or {}
            if status_code == 200 and isinstance(body, dict):
                flow_pk = body.get("id")
                # plantilla de ejemplo: ajustar si corresponde
                plantilla_flow = PlantillaFlow.objects.get(pk=1)
                if flow_pk:
                    f, created = Flow.objects.get_or_create(
                        pk=flow_pk,
                        defaults={
                            "id_plantilla_flow": plantilla_flow,
                            "para": telefono,
                            "desde": "3416082860",
                            "id_estado_id": 0,
                            "fecha_inicio": timezone.now()
                        },
                    )
                    # si ya existía y querés forzar estado a 0:
                    if not created and f.id_estado_id != 0:
                        f.id_estado_id = 0
                        f.save(update_fields=["id_estado_id"])

                    # crear TurnoFlow idempotente
                    TurnoFlow.objects.get_or_create(id_turno=turno, id_flow=f)

                    # actualizar estado paciente
                    turno.id_estado_paciente_id = 4
                    turno.save(update_fields=["id_estado_paciente"])
            else:
                ack = decode_res(res)
                if ack < 0:
                    turno.id_estado_paciente_id = ack
                    turno.save(update_fields=["id_estado_paciente"])


        # FIN transaction.atomic()

        # si marcamos reintento, lo hacemos **fuera** del atomic y usando el mecanismo de Celery
        if need_retry:
            try:
                # self.retry lanzará una excepción especial que marca el task como reintentado
                raise self.retry(exc=Exception("Flow activo, reintentando más tarde"))
            except self.MaxRetriesExceededError:
                print(f"[WARN] Max retries excedidos para turno {id_turno}. No se enviará recordatorio.")
                return


    except Exception as e:
        print(f"[ERROR general en send_reminder_task para id_turno={id_turno}]: {e}")
