from __future__ import annotations
import emoji
from typing import Any, cast
from django.contrib.auth.models import AbstractUser
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from src.models import (Plantilla, EstadoMsj, EstadoTurno,
                Turno, Mensaje, Efector, Servicio, Especialidad, EfectorPlantilla)


class PlantillaSerializer(serializers.ModelSerializer):
    contenido = serializers.SerializerMethodField()

    class Meta:
        model = Plantilla
        fields = '__all__'

    def get_contenido(self, obj):
        return emoji.emojize(obj.contenido or "")

class EstadoMsjSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoMsj
        fields = '__all__' 

class EstadoTurnoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoTurno
        fields = '__all__' 

class TurnoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Turno
        fields = '__all__'


class MensajeSerializer(serializers.ModelSerializer):
    turno: Turno = TurnoSerializer(source='id_turno', read_only=True)
    plantilla: Plantilla = PlantillaSerializer(source='id_plantilla', read_only=True)
    estado: EstadoMsj = EstadoMsjSerializer(source='id_estado', read_only=True)
    class Meta:
        model = Mensaje
        fields = '__all__'



class EfectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Efector
        fields = '__all__'


class ServicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servicio
        fields = '__all__'


class EspecialidadSerializer(serializers.ModelSerializer):
    servicio = ServicioSerializer(source='id_servicio', read_only=True)
    class Meta:
        model = Especialidad
        fields = '__all__'



class EfectorPlantillaSerializer(serializers.ModelSerializer):
    # ligero: solo ids (mantenerlo como ya lo tenías)
    class Meta:
        model = EfectorPlantilla
        fields = '__all__'

class EfectorPlantillaDetailSerializer(serializers.ModelSerializer):
    efector = EfectorSerializer(source='id_efector', read_only=True)
    servicio = ServicioSerializer(source='id_servicio', read_only=True)
    especialidad = EspecialidadSerializer(source='id_especialidad', read_only=True)

    plantilla_conf = PlantillaSerializer(read_only=True)
    plantilla_repr = PlantillaSerializer(read_only=True)
    plantilla_canc = PlantillaSerializer(read_only=True)
    plantilla_reco = PlantillaSerializer(read_only=True)

    class Meta:
        model = EfectorPlantilla
        fields = '__all__'


from rest_framework import serializers
from .models import Turno, Mensaje




class HistoricoPacienteSerializer(serializers.Serializer):
    idturno = serializers.IntegerField()
    fecha_hora_mdf = serializers.DateTimeField(allow_null=True, required=False)
    estado = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    paciente_nombre = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    paciente_apellido = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    nro_doc = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    nombre_profesional = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    apellido_profesional = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    fecha = serializers.DateField(allow_null=True, required=False)
    hora = serializers.TimeField(allow_null=True, required=False)
    efector = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    servicio = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    especialidad = serializers.CharField(allow_null=True, allow_blank=True, required=False)






class TurnoMergedSerializer(serializers.ModelSerializer):
    efector = EfectorSerializer(source="id_efector", read_only=True)
    servicio = ServicioSerializer(source="id_servicio", read_only=True)
    especialidad = EspecialidadSerializer(source="id_especialidad", read_only=True)

    msj_recordatorio = serializers.IntegerField(read_only=True, allow_null=True)
    msj_confirmado = serializers.IntegerField(read_only=True, allow_null=True)
    msj_cancelado = serializers.IntegerField(read_only=True, allow_null=True)
    msj_reprogramado = serializers.IntegerField(read_only=True, allow_null=True)

    # Campos extra desde Informix
    paciente_nombre = serializers.CharField(read_only=True, allow_null=True)
    paciente_apellido = serializers.CharField(read_only=True, allow_null=True)
    paciente_dni = serializers.CharField(read_only=True, allow_null=True)
    profesional_nombre = serializers.CharField(read_only=True, allow_null=True)
    profesional_apellido = serializers.CharField(read_only=True, allow_null=True)

    estado = EstadoTurnoSerializer(source="id_estado", read_only=True)

    # Nuevo campo dinámico
    mensaje_asociado = serializers.SerializerMethodField()

    class Meta:
        model = Turno
        fields = [
            "id", "fecha", "hora", "estado",
            "msj_recordatorio", "msj_confirmado", "msj_cancelado", "msj_reprogramado",
            "efector", "servicio", "especialidad",
            "paciente_nombre", "paciente_apellido", "paciente_dni",
            "profesional_nombre", "profesional_apellido",
            "mensaje_asociado",  # 👈 acá lo agregamos
        ]

    def get_mensaje_asociado(self, obj):
        """
        Devuelve la lista de mensajes asociados al turno,
        solo si alguno de los msj_* está en 1.
        """
        if (
            obj.msj_recordatorio == 1
            or obj.msj_confirmado == 1
            or obj.msj_cancelado == 1
            or obj.msj_reprogramado == 1
        ):
            mensajes = (
                Mensaje.objects.filter(id_turno=obj)
                .select_related("id_plantilla__id_tipo", "id_estado")
                .order_by("-fecha_envio")
            )
            return [
                {
                    "id": m.id,
                    "id_mensaje": m.id_mensaje,
                    "numero": m.numero if m.numero else None,
                    "fecha_envio": m.fecha_envio if m.fecha_envio else None,
                    "estado": {
                        "id": m.id_estado.id if m.id_estado else None,
                        "significado": m.id_estado.significado if m.id_estado else None,
                    } if m.id_estado else None,
                    "plantilla": {
                        "id": m.id_plantilla.id if m.id_plantilla else None,
                        "contenido": emoji.emojize(m.id_plantilla.contenido) if m.id_plantilla else None,
                        "tipo": {
                            "id": m.id_plantilla.id_tipo.id,
                            "nombre": m.id_plantilla.id_tipo.nombre,
                        } if m.id_plantilla.id_tipo else None,
                    } if m.id_plantilla else None,
                    "fecha_last_ack": m.fecha_last_ack if m.fecha_last_ack else None,
                }
                for m in mensajes
            ]
        return []

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        data: dict[str, Any] = super().validate(attrs)

        user = cast(AbstractUser, self.user)
        data['username'] = user.username

        data['efectores'] = list(user.efectores.values('id', 'nombre'))
        return data
