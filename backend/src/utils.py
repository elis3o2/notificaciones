import requests
import emoji
from decouple import config
from src.models import EfectorPlantilla, Mensaje
from src.serializers import PlantillaSerializer
import re
import logging
logger = logging.getLogger(__name__)
# Función para enviar mensajes WhatsApp
from rest_framework.response import Response
from rest_framework import status
from django.utils.timezone import now

def get_actual_state(mensaje_id, id_mensaje_externo, numero):
    """
    Consulta la API externa por el estado del mensaje y actualiza Mensaje(pk=mensaje_id).
    Devuelve exactamente lo que devuelve la API externa.
    """
    api_url = config("API_ESTADO_WHATSAPP")
    params = {"numero": numero, "id": id_mensaje_externo}

    try:
        resp = requests.get(api_url, params=params, timeout=10)
    except requests.exceptions.RequestException as e:
        return Response(
            {"error": "No se pudo conectar con el servicio de WhatsApp", "detail": str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        data = resp.json()
    except ValueError:
        return Response(
            {"error": "Respuesta inválida (no JSON) desde API externa", "raw_response": resp.text},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    # Actualizar Mensaje local si existe
    try:
        msj = Mensaje.objects.get(pk=mensaje_id)
        msj.fecha_last_ack = now()
        if "ack" in data:
            msj.id_estado_id = data["ack"]  # asumimos que id_estado es FK a id de estado
        msj.save(update_fields=["fecha_last_ack", "id_estado"])
    except Mensaje.DoesNotExist:
        pass  # si no existe, no hacemos nada, seguimos devolviendo la respuesta externa

    return Response(data=data, status=resp.status_code)


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
    
def check_turno(efector, servicio, especialidad, estado):
    try:
        turno = EfectorPlantilla.objects.filter(
            id_efector=efector,
            id_servicio=servicio,
            id_especialidad=especialidad
        ).first()
        
        if not turno:
            return False, None
        
        # Mapear estado → tipo y campo de plantilla
        mapping = {
            0: ("confirmacion", "plantilla_conf"),
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




