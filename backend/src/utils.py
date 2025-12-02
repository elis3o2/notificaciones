import requests
import emoji
from decouple import config
from src.models import EfeSerEspPlantilla, Mensaje, Flow, TurnoFlow
import re
import logging
logger = logging.getLogger(__name__)
from rest_framework.response import Response
from rest_framework import status
from django.utils.timezone import now
from django.db import connections, DatabaseError



def update_msg_state(mensaje: Mensaje):
    """
    Consulta la API externa por el estado del mensaje y actualiza Mensaje(pk=mensaje_id).
    Devuelve exactamente lo que devuelve la API externa.
    """
    api_url = config("API_ESTADO_WHATSAPP")
    params = {"numero": mensaje.numero, "id": mensaje.id_mensaje}
    try:
        resp = requests.get(api_url, params=params, timeout=2)
        data = resp.json()

    except:
        return mensaje

    # Actualizar Mensaje local si existe
    try:
        mensaje.fecha_last_ack = now()
        if "ack" in data:
            mensaje.id_estado_id = data["ack"]  # asumimos que id_estado es FK a id de estado
        mensaje.save(update_fields=["fecha_last_ack", "id_estado"])
        return mensaje
    except:
        return mensaje


def enviar_whatsapp(numero, mensaje):
    """
    Envía un mensaje WhatsApp usando la API externa y devuelve la respuesta directa del servidor
    """
    api_url = config('API_WHATSAPP') 
    
    # Preparar datos para la API externa (form-data)
    payload = {
        "numero": numero,
        "texto": mensaje
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
    
def check_turno(efe_ser_esp, estado):
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



def format_plantilla(contenido, valores):
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

    if id_persona:
        where = "WHERE per.id_persona = ?"
        params = (id_persona,)
    else:
        where = "WHERE per.nro_doc = ?"
        params = (dni,)

    sql = f"""
        SELECT
            per.id_persona AS id,
            per.nro_doc,
            TRIM(per.nombre_per) AS nombre,
            TRIM(per.apellido)    AS apellido,
            per.carac_telef,
            per.nro_telef,
            per.fe_naci AS fecha_nacimiento,
            per.sexo,
            TRIM(calle.nom_calle) AS nombre_calle,
            per.numero_dec AS numero_calle
        FROM v_personas per
        LEFT JOIN v_calles calle ON calle.cod_calle = per.cod_calle_dec
        {where}
    """

    try:
        with connections['informix'].cursor() as cur:
            cur.execute(sql, params)
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
        sql = """
            SELECT DISTINCT
                p.idpersonal AS id,
                TRIM(p.apellido) AS apellido,
                TRIM(p.nombre)   AS nombre
            FROM personal p
            WHERE p.idpersonal = ?
        """
        params = [id_prof]
    else:
        if not id_efector:
            return []
        sql = """
            SELECT DISTINCT
                p.idpersonal AS id,
                TRIM(p.apellido) AS apellido,
                TRIM(p.nombre)   AS nombre
            FROM personal p
            JOIN personalefector pe ON p.idpersonal = pe.idpersonal
            WHERE pe.idefector = ?
              AND p.estado = 1
        """
        params = [id_efector]
        if nombre and nombre.strip():
            sql += " AND p.nombre LIKE ?"
            params.append(nombre.strip().upper() + '%')
        if apellido and apellido.strip():
            sql += " AND p.apellido LIKE ?"
            params.append(apellido.strip().upper() + '%')

        sql += " ORDER BY apellido, nombre"

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


def start_flow(numero,flowName):
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