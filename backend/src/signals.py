# app/signals.py
from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import EfeSerEspPlantilla, RegistroBanderas

BANDERA_CONFIRMACION = 1
BANDERA_CANCELACION = 2
BANDERA_REPROGRAMACION = 3
BANDERA_RECORDATORIO = 4

@receiver(pre_save, sender=EfeSerEspPlantilla)
def auditar_cambios(sender, instance, **kwargs):
    """
    Detecta cambios en campos relevantes de EfeSerEspPlantilla y crea registros en RegistroBanderas.
    Requiere que, antes de guardar, si se desea guardar el usuario, se setee instance._usuario (ej: en admin).
    """
    # Si es creación, no auditamos cambios
    if not instance.pk:
        return

    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    # compara campo por campo y crea el registro correspondiente
    cambios = []

    # confirmacion
    if old.confirmacion != instance.confirmacion:
        cambios.append({
            "bandera_id": BANDERA_CONFIRMACION,
            "valor_set": instance.confirmacion,
            "plantilla": getattr(instance, "plantilla_conf", None),
            "dias_antes": None
        })

    # cancelacion
    if old.cancelacion != instance.cancelacion:
        cambios.append({
            "bandera_id": BANDERA_CANCELACION,
            "valor_set": instance.cancelacion,
            "plantilla": getattr(instance, "plantilla_canc", None),
            "dias_antes": None
        })

    # reprogramacion (repr)
    if old.reprogramacion != instance.reprogramacion:
        cambios.append({
            "bandera_id": BANDERA_REPROGRAMACION,
            "valor_set": instance.reprogramacion,
            "plantilla": getattr(instance, "plantilla_repr", None),
            "dias_antes": None
        })

    # recordatorio
    if old.recordatorio != instance.recordatorio:
        cambios.append({
            "bandera_id": BANDERA_RECORDATORIO,
            "valor_set": instance.recordatorio,
            "plantilla": getattr(instance, "plantilla_reco", None),
            "dias_antes": getattr(instance, "dias_antes", None)
        })

    usuario = getattr(instance, "_usuario", None)

    # Crear los registros
    for cambio in cambios:
        RegistroBanderas.objects.create(
            usuario=usuario,
            efec_esp_serv_plantilla=instance,
            bandera_id=cambio["bandera_id"],
            valor_set=cambio["valor_set"],
            plantilla=cambio["plantilla"],
            dias_antes=cambio["dias_antes"]
        )
