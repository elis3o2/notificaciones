import requests
import emoji
from decouple import config
from src.models import EfeSerEspPlantilla, Mensaje, Flow, TurnoFlow, Turno, Plantilla, TurnoEspera
import re
import logging
logger = logging.getLogger(__name__)
from rest_framework.response import Response
from rest_framework import status
from django.utils.timezone import now
from django.db import connections, DatabaseError
from datetime import timedelta, datetime, date, time
from .querys_informix import query_profesional_from_id,query_profesional_from_nombre, query_paciente



def update_msg_state(mensaje: Mensaje) -> Mensaje:
    """
    Consulta la API externa por el estado del mensaje y actualiza Mensaje(pk=mensaje_id).
    Devuelve el Mensaje actualizado o el original si hay error.
    """
    api_url = config("API_ESTADO_WHATSAPP")
    params = {
        "session": mensaje.id_sesion_id,
        "numero": mensaje.numero,
        "id": mensaje.id_mensaje
    }

    session = requests.Session()
    session.trust_env = False 

    try:
        resp = session.get(
            api_url,
            params=params,
            headers={
                "Accept": "application/json"
            },
            timeout=5
        )

        content_type = resp.headers.get("Content-Type", "")

        if "application/json" not in content_type:
            return mensaje

        data = resp.json()

    except requests.exceptions.RequestException:
        return mensaje
    except ValueError:
        return mensaje

    # Actualizar Mensaje local si existe
    try:
        mensaje.fecha_last_ack = now()
        if isinstance(data, dict) and "ack" in data:
            mensaje.id_estado_id = data["ack"]

        mensaje.save(update_fields=["fecha_last_ack", "id_estado"])
        return mensaje

    except Exception:
        return mensaje



def enviar_whatsapp(numero: str, mensaje: str) -> Response:
    api_url = config('API_WHATSAPP')

    session = requests.Session()
    session.trust_env = False  # ← clave

    try:
        response = session.post(
            api_url,
            json={
                "numero": numero,
                "texto": mensaje
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            timeout=15
        )

        content_type = response.headers.get("Content-Type", "")

        if "application/json" in content_type:
            return Response(response.json(), status=response.status_code)

        return Response(
            {
                "error": "Respuesta no JSON desde la API WhatsApp",
                "status_code": response.status_code,
                "raw_response": response.text[:500]
            },
            status=status.HTTP_502_BAD_GATEWAY
        )

    except requests.exceptions.RequestException as e:
        return Response(
            {"error": "No se pudo conectar con la API WhatsApp", "detail": str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    
def check_turno(efe_ser_esp: int, estado: int) -> (bool, Plantilla | None):
    try:
        turno = EfeSerEspPlantilla.objects.filter(
            id_efe_ser_esp=efe_ser_esp,
        ).first()
        
        if not turno:
            return False, None
        
        # Mapear estado → tipo y campo de plantilla
        mapping = {
            1: ("confirmacion", "plantilla_conf"),
            2: ("cancelacion", "plantilla_canc"),
            3: ("reprogramacion", "plantilla_repr"),
        }
        
        tipo, campo_plantilla = mapping.get(estado, ("recordatorio", "plantilla_reco"))
        
        # Chequear si el flag booleano del tipo está activo
        if getattr(turno, tipo) == 1:  
            plantilla = getattr(turno, campo_plantilla)
            if plantilla:
                plantilla.contenido = emoji.emojize(plantilla.contenido)
            return True, plantilla

        
        return False, None
    
    except Exception as e:
        print(f"Error en check_turno: {e}")
        return False, None



def format_plantilla(contenido: str, valores) -> str:
    """
    Reemplaza placeholders en la plantilla con valores reales
    Ejemplo: {nompac} -> Juan
    """
    def replace_match(match):
        key = match.group(1)  # Obtiene el nombre entre llaves
        return str(valores.get(key, match.group(0)))  # Reemplaza o deja original si no existe
    
    # Usa expresión regular para encontrar {placeholder}
    return re.sub(r'{(\w+)}', replace_match, contenido)


def fetch_paciente(id_persona=None, dni=None):
    """
    Retorna lista de dicts con pacientes (posiblemente vacía).
    """
    if not id_persona and not dni:
        return []
    id: bool
    if id_persona:
        id = True
        params = (id_persona,)
    else:
        id = False
        params = (dni,)


    try:
        with connections['informix'].cursor() as cur:
            cur.execute(query_paciente(id), params)
            rows = cur.fetchall()
            if not rows:
                return []

            desc = cur.description or []
            cols = [str(c[0]).lower() for c in desc]
            result = []
            for r in rows:
                result.append({ cols[i]: r[i] for i in range(len(r)) })
            return result

    except DatabaseError:
        logger.exception("Error consultando Informix (paciente list)")
        raise


def fetch_profesional(id_prof=None, id_efector=None, nombre=None, apellido=None):
    """
    Retorna lista de dicts con profesionales que coincidan (posiblemente vacía).
    Si id_prof está provisto busca por idpersonal; si no, usa id_efector + filtros.
    """
    params = []
    if id_prof:
        sql = query_profesional_from_id()
        params = [id_prof]
    else:
        if not id_efector:
            return []
        sql = query_profesional_from_nombre(id_efector, nombre, apellido)
        params = [id_efector]
        if nombre:
            params.append(nombre.strip().upper() + '%')
        if apellido:
            params.append(apellido.strip().upper() + '%')

    try:
        with connections['informix'].cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()
            if not rows:
                return []

            desc = cur.description or []
            cols = [str(c[0]).lower() for c in desc]
            result = []
            for r in rows:
                result.append({ cols[i]: r[i] for i in range(len(r)) })
            return result

    except DatabaseError:
        logger.exception("Error consultando Informix (profesional list)")
        raise


def start_flow(numero: str, flowName: str) -> Response:
    api_url = config('API_WHATSAPP_FLOW') 
    
    port = config('LISTEN_PORT')
    api = config('API_LISTEN')
    endpoint = f"http://localhost:{port}/{api}"
    # Preparar datos para la API externa (form-data)
    payload = {
        "numero": numero,
        "flowName": flowName,
        "endpoint": endpoint
    }

    try:
        # Realizar solicitud a la API externa
        response = requests.post(api_url, data=payload)
        
        # Devolver la respuesta directa del servidor externo
        # Incluyendo el código de estado y el contenido
        return Response(
            data=response.json(),
            status=response.status_code
        )
        
    except requests.exceptions.RequestException as e:
        # En caso de error de conexión
        return Response(
            {"error": f"No se pudo conectar con el servicio de WhatsApp: {str(e)}"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except ValueError as e:
        # En caso de que la respuesta no sea JSON válido
        return Response(
            {"error": f"Respuesta inválida del servidor: {str(e)}", "raw_response": response.text},
            status=status.HTTP_502_BAD_GATEWAY
        )
    


def update_estado_Turno(id_sisr: int, id_pac: int, id_est: int) -> Turno | None: 
    try:
        # Obtener instancia
        t = Turno.objects.filter(id_sisr=id_sisr, id_paciente=id_pac).first()
        if t is None:
            print(f"[DEBUG] No existe Turno local con id={id_sisr} => se ignora notificación (estado={id_est})")
            return None

        # Asignar estado en la instancia y guardar (mínimo)
        if t.id_estado_id != id_est:
            t.id_estado_id = id_est
            t.save(update_fields=["id_estado_id"])

        print(f"[INFO] Actualizado Turno id={id_sisr} a estado={id_sisr}")
        return t
    
    except Exception as ex:
        print(f"[ERROR] al actualizar Turno id={id_sisr}: {ex}")
        return None

def create_Turno(id_sisr: int, id_pac: int, id_est: int, 
                 id_ess: int, fecha: date, hora: time) -> Turno:
    t = Turno.objects.create(
            id_sisr=id_sisr,
            id_paciente=id_pac,
            id_estado_id=id_est,
            id_estado_paciente_id=0,
            msj_confirmado=0,
            msj_reprogramado=0,
            msj_cancelado=0,
            msj_recordatorio=0,
            id_efe_ser_esp_id=id_ess,
            fecha=fecha,
            hora=hora
        )
    return t


def create_Mensaje(id: str | None, turno: Turno, numero: str | None,
                plantilla: Plantilla, estado: int, fecha: datetime| None, sesion: str | None) -> None:
    if fecha == None:
        fecha = datetime.now()

    Mensaje.objects.create(
        id_mensaje=id,
        id_turno=turno,
        numero=numero,
        id_plantilla=plantilla,
        fecha_envio=fecha,
        id_estado_id=estado,
        id_sesion_id=sesion
    )



def sacar_Turno_Espera(id_pac: int, id_efe_ser_esp: int) -> bool:
    updated = TurnoEspera.objects.filter(
        id_paciente=id_pac,
        id_efe_ser_esp=id_efe_ser_esp,
        id_estado_id=0
    ).update(id_estado_id=1, fecha_hora_cierre=now())

    return updated > 0



    
def map_estdo(est: int) -> int:
    if est == 3:
        estado = 1
    elif est in (4, 5, 6):
        estado = 4
    elif est in (1, 2, 7):
        estado = 2
    elif est == 8:
        estado = 3
    return estado


def decode_res(res: Response) -> int:
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



def create_flow(telefono: str, turno: Turno ) -> None:
    try:
        res = start_flow(telefono, "confirmacion-turno")
    except Exception as ex:
        print(f"[ERROR] start_flow falla para turno {id_turno}: {ex}")
        return

    status_code = getattr(res, "status_code", None)
    body = getattr(res, "data", {}) or {}
    if status_code == 200 and isinstance(body, dict):
        flow_pk = body.get("id")
        plantilla_flow = PlantillaFlow.objects.get(pk=1)
        sesion=body.get("id", None)
        if flow_pk:
            f, created = Flow.objects.get_or_create(
                pk=flow_pk,
                defaults={
                    "id_plantilla_flow": plantilla_flow,
                    "para": telefono,
                    "sesion_id": sesion,
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
