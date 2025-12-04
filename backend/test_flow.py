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

id_turno = 9994750
telefono = ("549" + str(341) + str(6082860)).replace(" ", "")
res = start_flow(telefono, "confirmacion-turno")
if res.status_code == 200 and isinstance(res.data, dict):
    body = res.data
    flow_pk = body.get("id")
    external_flow_name = body.get("flow")  # "confirmar_turno_v1"
    plantilla = PlantillaFlow.objects.get(pk=1)  # o la instancia que corresponda
    if flow_pk:
        f, created = Flow.objects.get_or_create(
            pk=flow_pk,
            defaults={
                "id_plantilla_flow": plantilla,
                "para": telefono,
                "desde":"516555",
                "id_estado_id":0
            },
        )
        # crear TurnoFlow idempotente
        TurnoFlow.objects.get_or_create(id_turno_id=id_turno, id_flow=f)
