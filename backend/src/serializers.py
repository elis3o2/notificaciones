from __future__ import annotations
import emoji
from typing import Any, cast
from django.contrib.auth.models import AbstractUser
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from src.models import (Plantilla, EstadoMsj, EstadoTurno,
                Turno, Mensaje, Efector, Servicio, Especialidad, Deriva, EfeSerEspPlantilla,
                EstadoTurnoEspera, TurnoEspera, EfeSerEsp, EstudioRequerido, EstadoTurnoPaciente, Flow, TurnoFlow)
from src.utils.utils import fetch_paciente, fetch_profesional, update_msg_state
import re
from django.utils import timezone
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor

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


class EstadoTurnoPacienteSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = EstadoTurnoPaciente
        fields = '__all__' 



class TurnoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Turno
        fields = '__all__'


class MensajeSerializer(serializers.ModelSerializer):
    turno = TurnoSerializer(source='id_turno', read_only=True)
    plantilla = PlantillaSerializer(source='id_plantilla', read_only=True)
    estado = EstadoMsjSerializer(source='id_estado', read_only=True)
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
    class Meta:
        model = Especialidad
        fields = '__all__'



class EfeSerEspSerializer(serializers.ModelSerializer):
    class Meta:
        model = EfeSerEsp
        fields = ['id', 'id_efector', 'id_servicio', 'id_especialidad']


class DerivaSerializer(serializers.ModelSerializer):
    efector = EfectorSerializer(source='id_efector', read_only=True)
    efector_deriva = EfectorSerializer(source='id_efe_ser_esp_deriva.id_efector', read_only=True)
    servicio_deriva = ServicioSerializer(source='id_efe_ser_esp_deriva.id_servicio', read_only=True)
    especialidad_deriva = EspecialidadSerializer(source='id_efe_ser_esp_deriva.id_especialidad', read_only=True)

    class Meta:
        model = Deriva
        fields = ['id', 'cupo', 'efector', 'efector_deriva', 'servicio_deriva', 'especialidad_deriva']

class EfeSerEspEfectorSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="id_efector.id", read_only=True)
    nombre = serializers.CharField(source="id_efector.nombre", read_only=True)

    class Meta:
        model = EfeSerEsp
        fields = ["id", "nombre"]


class EfeSerEspCompletoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField()
    efector = EfectorSerializer(source='id_efector', read_only=True)
    servicio = ServicioSerializer(source='id_servicio', read_only=True)
    especialidad = EspecialidadSerializer(source='id_especialidad', read_only=True)

    class Meta:
        model = EfeSerEsp
        fields = ["id", "efector", "servicio", "especialidad"]

class EfeSerEspPlantillaSerializer(serializers.ModelSerializer):
    efe_ser_esp = EfeSerEspSerializer(source='id_efe_ser_esp', read_only=True)

    class Meta:
        model = EfeSerEspPlantilla
        fields = '__all__'

    def update(self, instance, validated_data):
        # request está en self.context cuando el serializer lo usa desde un ViewSet
        request = self.context.get("request")
        if request is not None:
            instance._usuario = request.user  # <-- setear antes de guardar
        # ahora llamar al update normal que hará instance.save() y disparará pre_save
        return super().update(instance, validated_data)



class EfeSerEspPlantillaDetailSerializer(serializers.ModelSerializer):
    especialidad = EspecialidadSerializer(source="id_efe_ser_esp.id_especialidad", read_only=True)
    id_efector = serializers.SerializerMethodField()
    id_servicio = serializers.SerializerMethodField()

    # HACEMOS LOS CAMPOS ESCRIBIBLES POR PK (aceptan un entero en el request)
    plantilla_conf = serializers.PrimaryKeyRelatedField(
        queryset=Plantilla.objects.all(), required=False, allow_null=True)
    plantilla_repr = serializers.PrimaryKeyRelatedField(
        queryset=Plantilla.objects.all(), required=False, allow_null=True)
    plantilla_canc = serializers.PrimaryKeyRelatedField(
        queryset=Plantilla.objects.all(), required=False, allow_null=True)
    plantilla_reco = serializers.PrimaryKeyRelatedField(
        queryset=Plantilla.objects.all(), required=False, allow_null=True)

    class Meta:
        model = EfeSerEspPlantilla
        fields = [
            "id",
            "id_efe_ser_esp",
            "id_efector",
            "id_servicio",
            "especialidad",
            "confirmacion",
            "plantilla_conf",
            "reprogramacion",
            "plantilla_repr",
            "cancelacion",
            "plantilla_canc",
            "recordatorio",
            "plantilla_reco",
            "dias_antes",
        ]

    def get_id_efector(self, obj):
        return obj.id_efe_ser_esp.id_efector_id if obj.id_efe_ser_esp else None

    def get_id_servicio(self, obj):
        return obj.id_efe_ser_esp.id_servicio_id if obj.id_efe_ser_esp else None

    def to_representation(self, instance):
        """
        Representación para la salida: queremos devolver los objetos 'Plantilla'
        anidados (igual que antes), no sólo los PKs.
        """
        rep = super().to_representation(instance)

        # reemplazamos los PKs por la representación anidada si existe
        rep["plantilla_conf"] = (
            PlantillaSerializer(instance.plantilla_conf).data if instance.plantilla_conf else None)
        rep["plantilla_repr"] = (
            PlantillaSerializer(instance.plantilla_repr).data if instance.plantilla_repr else None)
        rep["plantilla_canc"] = (
            PlantillaSerializer(instance.plantilla_canc).data if instance.plantilla_canc else None)
        rep["plantilla_reco"] = (
            PlantillaSerializer(instance.plantilla_reco).data if instance.plantilla_reco else None)

        return rep


class EstadoTurnoEsperaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoTurnoEspera
        fields = '__all__'



class PacienteSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, allow_null=True)
    nombre = serializers.CharField(required=False, allow_null=True)
    apellido = serializers.CharField(required=False, allow_null=True)
    nro_doc = serializers.CharField(required=False, allow_null=True)    
    carac_telef = serializers.CharField(required=False, allow_null=True)
    nro_telef = serializers.CharField(required=False, allow_null=True)
    fecha_nacimiento = serializers.DateField(required=False, allow_null=True)
    sexo = serializers.CharField(required=False, allow_null=True)
    nombre_calle = serializers.CharField(required=False, allow_null=True)
    numero_calle = serializers.IntegerField(required=False, allow_null=True)
    
    def to_representation(self, instance):
        rep = super().to_representation(instance)
        if rep.get("carac_telef"):
            rep["carac_telef"] = str(rep["carac_telef"]).replace(" ", "")
        if rep.get("nro_telef"):
            rep["nro_telef"] = str(rep["nro_telef"]).replace(" ", "")
        return rep

class ProfesionalSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, allow_null=True)
    apellido = serializers.CharField(required=False, allow_null=True)
    nombre = serializers.CharField(required=False, allow_null=True)



class EstudioRequeridoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstudioRequerido
        fields = '__all__'

class TurnoEsperaSerializer(serializers.ModelSerializer):
    estado = EstadoTurnoEsperaSerializer(source='id_estado', read_only=True)
    efector =  EfectorSerializer(source='id_efe_ser_esp.id_efector', read_only=True)
    servicio = ServicioSerializer(source='id_efe_ser_esp.id_servicio', read_only=True)
    especialidad = EspecialidadSerializer(source='id_efe_ser_esp.id_especialidad', read_only=True)
    efector_solicitante = EfectorSerializer(source='id_efector_solicitante', read_only=True)
    # campos adicionales para paciente y profesional
    paciente = serializers.SerializerMethodField()
    profesional_solicitante = serializers.SerializerMethodField()
    estudio_requerido = EstudioRequeridoSerializer(many=True, read_only=True)
   
    class Meta:
        model = TurnoEspera
        fields = ["id", "efector", "servicio","cupo","especialidad", "efector_solicitante",
                  "paciente", "profesional_solicitante", "estado", "prioridad",
                  "usuario_cierre", "usuario_creacion", "fecha_hora_creacion", 
                  "fecha_hora_cierre", "estudio_requerido"]   

    def get_paciente(self, obj):
        try:
            data = fetch_paciente(id_persona=obj.id_paciente)
            if data:
                return PacienteSerializer(data[0]).data
            return None
        except Exception:
            return None

    def get_profesional_solicitante(self, obj):
        try:
            data = fetch_profesional(id_prof=obj.id_profesional_solicitante)
            if data:
                # igual que paciente, es único si buscamos por id
                return ProfesionalSerializer(data[0]).data
            return None
        except Exception:
            return None


class TurnoEsperaCreateSerializer(serializers.ModelSerializer):
    estudio_requerido = serializers.PrimaryKeyRelatedField(
        many=True, queryset=EstudioRequerido.objects.all()
    )

    class Meta:
        model = TurnoEspera
        fields = (
            "id_efe_ser_esp",
            "id_efector_solicitante",
            "id_profesional_solicitante",
            "id_paciente",
            "prioridad",
            "estudio_requerido",
            "cupo",
        )
        read_only_fields = ("usuario_creacion", "fecha_hora_creacion", "id_estado")

    def create(self, validated_data):
        # Extraer M2M para no pasarlo a Model.objects.create(...)
        estudios_in = validated_data.pop("estudio_requerido", [])

        request = self.context.get("request")
        user = getattr(request, "user", None)

        # Setear usuario/fecha si no vienen
        if user and "usuario_creacion" not in validated_data:
            validated_data["usuario_creacion"] = user
        if "fecha_hora_creacion" not in validated_data:
            validated_data["fecha_hora_creacion"] = timezone.now()

        # Estado por defecto (pk=0 o el primero)
        if "id_estado" not in validated_data:
            estado = EstadoTurnoEspera.objects.filter(pk=0).first() or EstadoTurnoEspera.objects.first()
            if estado:
                validated_data["id_estado"] = estado

        # Crear la instancia sin M2M
        instance = TurnoEspera.objects.create(**validated_data)

        # Asociar estudios (acepta lista de IDs o lista de instancias)
        if estudios_in:
            # si vienen ids (ints), validamos que existan y usamos el queryset
            if all(isinstance(x, int) for x in estudios_in):
                qs = EstudioRequerido.objects.filter(pk__in=estudios_in)
                found_pks = set(qs.values_list("pk", flat=True))
                missing = set(estudios_in) - found_pks
                if missing:
                    raise serializers.ValidationError({
                        "estudio_requerido": f"Estudios no encontrados: {sorted(list(missing))}"
                    })
                instance.estudio_requerido.set(qs)
            else:
                # PrimaryKeyRelatedField normalmente ya devuelve instancias; aceptamos eso
                instance.estudio_requerido.set(estudios_in)
        else:
            # aseguramos que quede vacío si no se envió nada
            instance.estudio_requerido.clear()

        return instance
    

class TurnoEsperaCloseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TurnoEspera
        fields = ["id"]  # solo necesitamos que venga el id

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        close = EstadoTurnoEspera.objects.get(pk=1)
        instance.id_estado = close
        instance.fecha_hora_cierre = timezone.now()
        instance.usuario_cierre = user
        instance.save(update_fields=["id_estado", "fecha_hora_cierre", "usuario_cierre"])

        return instance



class EstudioRequeridoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstudioRequerido
        fields = '__all__'

from datetime import datetime, date

class HistoricoPacienteSerializer(serializers.Serializer):
    idturno = serializers.IntegerField()
    fecha_hora_mdf = serializers.DateTimeField(allow_null=True, required=False)

    estado = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    paciente_nombre = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    paciente_apellido = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    nro_doc = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    nombre_profesional = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    apellido_profesional = serializers.CharField(allow_null=True, allow_blank=True, required=False)

    # Campo fecha modificado para truncar hora
    fecha = serializers.DateField(format="%Y-%m-%d", allow_null=True, required=False)

    hora = serializers.TimeField(allow_null=True, required=False)
    efector = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    servicio = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    especialidad = serializers.CharField(allow_null=True, allow_blank=True, required=False)

    def to_representation(self, instance):
        rep = super().to_representation(instance)

        val = rep.get("fecha")
        if val:
            try:
                # Si viene con hora, convertir a date
                if isinstance(val, str):
                    val_dt = datetime.fromisoformat(val)
                    rep["fecha"] = val_dt.date()
                elif isinstance(val, datetime):
                    rep["fecha"] = val.date()
            except Exception:
                rep["fecha"] = val.split(" ")[0]

        return rep



class TurnoMergedSerializer(serializers.ModelSerializer):
    efe_ser_esp  = EfeSerEspCompletoSerializer(source="id_efe_ser_esp", read_only=True)

    msj_recordatorio = serializers.IntegerField(read_only=True, allow_null=True)
    msj_confirmado = serializers.IntegerField(read_only=True, allow_null=True)
    msj_cancelado = serializers.IntegerField(read_only=True, allow_null=True)
    msj_reprogramado = serializers.IntegerField(read_only=True, allow_null=True)
    fecha_estado_paciente = serializers.SerializerMethodField()
    # Campos extra desde Informix
    paciente_nombre = serializers.CharField(read_only=True, allow_null=True)
    paciente_apellido = serializers.CharField(read_only=True, allow_null=True)
    paciente_dni = serializers.CharField(read_only=True, allow_null=True)
    profesional_nombre = serializers.CharField(read_only=True, allow_null=True)
    profesional_apellido = serializers.CharField(read_only=True, allow_null=True)

    estado = EstadoTurnoSerializer(source="id_estado", read_only=True)
    estado_paciente = EstadoTurnoPacienteSerializer(source="id_estado_paciente", read_only=True)
    # Nuevo campo dinámico
    mensaje_asociado = serializers.SerializerMethodField()
    
    class Meta:
        model = Turno
        fields = [
            "id","fecha", "hora", "estado", "estado_paciente", "fecha_estado_paciente",
            "msj_recordatorio", "msj_confirmado", "msj_cancelado", "msj_reprogramado",
            "efe_ser_esp",
            "paciente_nombre", "paciente_apellido", "paciente_dni",
            "profesional_nombre", "profesional_apellido",
            "mensaje_asociado",  
        ]
    @staticmethod
    def procesar_mensaje(m: Mensaje):
        if 0 <= m.id_estado_id < 3:
            update_msg_state(m)

        return {
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
                "contenido": emoji.emojize(m.id_plantilla.contenido)
                if m.id_plantilla else None,
                "tipo": {
                    "id": m.id_plantilla.id_tipo.id,
                    "nombre": m.id_plantilla.id_tipo.nombre,
                } if m.id_plantilla and m.id_plantilla.id_tipo else None,
            } if m.id_plantilla else None,
            "fecha_last_ack": m.fecha_last_ack if m.fecha_last_ack else None,
        }


    def get_mensaje_asociado(self, obj):
        """
        Devuelve la lista de mensajes asociados al turno,
        solo si alguno de los msj_* está en 1.
        """
        
        mensajes = (
             Mensaje.objects.filter(id_turno=obj.id)
             .select_related("id_plantilla__id_tipo", "id_estado")
             .order_by("-fecha_envio")
            )
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            dic = list(executor.map(self.procesar_mensaje, mensajes))
        return dic
    
    def get_fecha_estado_paciente(self, obj):
        flow_ids = TurnoFlow.objects.filter(id_turno=obj.id).values_list("id_flow", flat=True)

        # usar obj.id_estado_id (atributo del modelo Turno)
        if obj.id_estado_id in (1, 2):
            flow = (
                Flow.objects.filter(id__in=flow_ids, id_plantilla_flow=1)
                .order_by("fecha_cierre")
                .first()
            )
            return flow.fecha_cierre if flow else None

        flow = (
            Flow.objects.filter(id__in=flow_ids, id_plantilla_flow=1)
            .order_by("fecha_inicio")
            .first()
        )
        return flow.fecha_inicio if flow else None






class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        data: dict[str, Any] = super().validate(attrs)

        user = cast(AbstractUser, self.user)
        data['username'] = user.username

        data['efectores'] = list(user.efectores.values('id', 'nombre'))
        return data
