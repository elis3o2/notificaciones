from django.db import models
from django.contrib.auth.models import AbstractUser
from core import settings

class TipoPlantilla(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=16)

    class Meta:
        managed = False
        db_table = 'tipo_plantilla'


class Plantilla(models.Model):
    id = models.AutoField(primary_key=True)
    contenido = models.TextField()
    id_tipo = models.ForeignKey(
        TipoPlantilla, models.DO_NOTHING, db_column='id_tipo')

    class Meta:
        managed = False
        db_table = 'plantilla'


class EstadoMsj(models.Model):
    id = models.IntegerField(primary_key=True)
    significado = models.CharField(max_length=32)

    class Meta:
        managed = False
        db_table = 'estado_msj'


class EstadoTurno(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=32)

    class Meta:
        managed = False
        db_table = 'estado_turno'

class EstadoTurnoPaciente(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=32)

    class Meta:
        managed = False
        db_table = 'estado_turno_paciente'


class Efector(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=64)

    class Meta:
        managed = False
        db_table = 'efector'
        ordering = ['nombre']


class Servicio(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=64, )

    class Meta:
        managed = False
        db_table = 'servicio'
        ordering = ['nombre']

class Especialidad(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=64)
    id_servicio = models.ForeignKey(
        Servicio, models.DO_NOTHING, db_column='id_servicio')

    class Meta:
        managed = False
        db_table = 'especialidad'
        ordering = ['nombre']


class EfeSerEsp(models.Model):
    id  = models.IntegerField(primary_key=True)
    id_efector  = models.ForeignKey(
        Efector, models.DO_NOTHING, db_column='id_efector')
    id_servicio  = models.ForeignKey(
        Servicio, models.DO_NOTHING, db_column='id_servicio')
    id_especialidad  = models.ForeignKey(
        Especialidad, models.DO_NOTHING, db_column='id_especialidad')
    
    class Meta:
        managed = False
        db_table = 'efe_ser_esp'


class Deriva(models.Model):
    id = models.AutoField(primary_key=True)
    id_efector = models.ForeignKey(
        Efector, models.DO_NOTHING, db_column='id_efector')
    id_efe_ser_esp_deriva = models.ForeignKey(
        EfeSerEsp, models.DO_NOTHING, db_column='id_efe_ser_esp_deriva')
    cupo = models.SmallIntegerField()

    class Meta:
        managed = False
        db_table = 'deriva'


class Turno(models.Model):
    id = models.AutoField(primary_key=True)
    id_sisr = models.IntegerField()
    id_paciente = models.IntegerField()
    id_estado = models.ForeignKey(
        EstadoTurno, models.DO_NOTHING, db_column='id_estado')
    id_estado_paciente = models.ForeignKey(
        EstadoTurnoPaciente, models.DO_NOTHING, default=0, db_column='id_estado_paciente')
    fecha = models.DateField()
    hora = models.TimeField()
    msj_confirmado = models.IntegerField()
    msj_reprogramado = models.IntegerField()
    msj_cancelado = models.IntegerField()
    msj_recordatorio = models.IntegerField()
    id_efe_ser_esp = models.ForeignKey(
        EfeSerEsp, models.DO_NOTHING, db_column='id_efe_ser_esp')

    class Meta:
        managed = False
        db_table = 'turno'


class Sesion(models.Model):
    id = models.CharField(max_length=3, primary_key=True)
    numero = models.CharField(max_length=16)

    class Meta:
        managed = False
        db_table = 'sesion'

class Mensaje(models.Model):
    id = models.AutoField(primary_key=True)
    id_mensaje = models.CharField(max_length=40, null=True, blank=True)
    id_turno = models.ForeignKey(
        Turno, models.DO_NOTHING, db_column='id_turno', null=True, blank=True)
    numero = models.CharField(max_length=20)
    id_sesion = models.ForeignKey(
        Sesion, models.DO_NOTHING, db_column='id_sesion', null=True, blank=True)
    id_plantilla = models.ForeignKey(
        Plantilla, models.DO_NOTHING, db_column='id_plantilla')
    fecha_envio = models.DateTimeField()
    fecha_last_ack = models.DateTimeField(null=True, blank=True)
    id_estado = models.ForeignKey(
        EstadoMsj, models.DO_NOTHING, db_column='id_estado')

    class Meta:
        managed = False
        db_table = 'mensaje'


class EstadoTurnoEspera(models.Model):
    id = models.IntegerField(primary_key=True)  # equivale a TINYINT UNSIGNED
    significado = models.CharField(max_length=16)

    class Meta:
        managed = False
        db_table = 'estado_turno_espera'


class TurnoEspera(models.Model):
    id = models.AutoField(primary_key=True)
    id_estado = models.ForeignKey(
        EstadoTurnoEspera, models.DO_NOTHING, db_column='id_estado')
    id_profesional_solicitante = models.IntegerField()
    id_efector_solicitante = models.ForeignKey(
        Efector, models.DO_NOTHING, db_column="id_efector_solicitante"
    )
    id_efe_ser_esp = models.ForeignKey(
        EfeSerEsp, models.DO_NOTHING, db_column='id_efe_ser_esp'
    )
    id_paciente = models.IntegerField()
    prioridad = models.IntegerField()
    fecha_hora_creacion = models.DateTimeField()
    fecha_hora_cierre = models.DateTimeField(null=True, blank=True)
    cupo = models.BooleanField()
    usuario_creacion = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='turnos_creados'   
    )
    usuario_cierre = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='turnos_cerrados', 
        null=True,
        blank=True
    )
    estudio_requerido = models.ManyToManyField(
        'EstudioRequerido',
        through='TurnoEsperaEstudio',
    )
    diagnostico = models.CharField(max_length=256,null=True,blank=True)

    class Meta:
        db_table = 'turno_espera'
        managed = True


class EfeSerEspPlantilla(models.Model):
    id = models.AutoField(primary_key=True)
    id_efe_ser_esp = models.ForeignKey(
        EfeSerEsp, models.DO_NOTHING, db_column='id_efe_ser_esp')
    confirmacion = models.IntegerField()
    reprogramacion = models.IntegerField()
    cancelacion = models.IntegerField()
    recordatorio = models.IntegerField()
    plantilla_conf = models.ForeignKey(
        Plantilla, models.DO_NOTHING, db_column='plantilla_conf',related_name="plantillas_conf", null=True, blank=True)
    plantilla_repr = models.ForeignKey(
        Plantilla, models.DO_NOTHING, db_column='plantilla_repr',related_name="plantillas_repr", null=True, blank=True)
    plantilla_canc = models.ForeignKey(
        Plantilla, models.DO_NOTHING, db_column='plantilla_canc',related_name="plantillas_canc", null=True, blank=True)
    plantilla_reco = models.ForeignKey(
        Plantilla, models.DO_NOTHING, db_column='plantilla_reco',related_name="plantillas_reco", null=True, blank=True)
    dias_antes = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'efe_ser_esp_plantilla'


class EstudioRequerido(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=32)

    class Meta:
        managed = False
        db_table = 'estudio_requerido'
        

class TurnoEsperaEstudio(models.Model):
    id = models.AutoField(primary_key=True)
    id_turno_espera  = models.ForeignKey(
        TurnoEspera,  models.DO_NOTHING, db_column='id_turno_espera')
    id_estudio_requerido  = models.ForeignKey(
        EstudioRequerido, models.DO_NOTHING, db_column='id_estudio_requerido')
    
    class Meta:
        db_table = 'turno_espera_estudio'

class CustomUser(AbstractUser):
    efectores = models.ManyToManyField(Efector, related_name="usuarios", blank=True)
    dni  = models.CharField(max_length=15, unique=True, null=True)

    def __str__(self):
        return self.username


class RegistroBanderas(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    efec_esp_serv_plantilla = models.ForeignKey(EfeSerEspPlantilla, on_delete=models.DO_NOTHING)
    bandera= models.ForeignKey(TipoPlantilla, on_delete=models.DO_NOTHING)
    valor_set  = models.IntegerField()
    plantilla  = models.ForeignKey(Plantilla, on_delete=models.DO_NOTHING, null=True)
    dias_antes  = models.IntegerField(null=True)
    fecha = models.DateTimeField(auto_now_add=True) 

class LastMod(models.Model):
    fecha = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "last_mod"



class TipoNodo(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=16, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'tipo_nodo'



class Nodo(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=24)
    msg = models.TextField(blank=True, null=True)
    tipo = models.ForeignKey(
        TipoNodo, 
        models.DO_NOTHING, 
        db_column='id_tipo'
    )
    id_nodo_sig = models.ForeignKey(
        'self', 
        models.DO_NOTHING, 
        db_column='id_nodo_sig', 
        blank=True, 
        null=True
    )

    class Meta:
        managed = False
        db_table = 'nodo'


class Ruta(models.Model):
    id = models.AutoField(primary_key=True)
    id_nodo = models.ForeignKey(
        Nodo, 
        models.DO_NOTHING, 
        db_column='id_nodo',
        related_name='rutas_origen' 
    )
    nombre_ruta = models.CharField(max_length=16)
    id_nodo_sig = models.ForeignKey(
        Nodo, 
        models.DO_NOTHING, 
        db_column='id_nodo_sig',
        related_name='rutas_destino'
    )

    class Meta:
        managed = False
        db_table = 'rutas'


class PlantillaFlow(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=24)
    nodo_inicio = models.ForeignKey(
        Nodo, 
        models.DO_NOTHING, 
        db_column='id_nodo_inicio'
    )

    class Meta:
        managed = False
        db_table = 'plantilla_flow'
        

class EstadoFlow(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=16)

    class Meta:
        managed = False
        db_table = 'estado_flow'

class Flow(models.Model):
    id = models.CharField(primary_key=True, max_length=20)
    id_plantilla_flow = models.ForeignKey(
        PlantillaFlow, 
        models.DO_NOTHING, 
        db_column='id_plantilla_flow'
    )
    id_sesion = models.ForeignKey(Sesion, models.DO_NOTHING, db_column='id_sesion')
    numero = models.CharField(max_length=15)
    fecha_inicio = models.DateTimeField()
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    id_estado =  models.ForeignKey(
        EstadoFlow, 
        models.DO_NOTHING, 
        db_column='id_estado'
    )

    class Meta:
        managed = False
        db_table = 'flow'


class MsgFlowEnv(models.Model):
    id = models.AutoField(primary_key=True)
    id_flow = models.ForeignKey(
        Flow, 
        models.DO_NOTHING, 
        db_column='id_flow'
    )
    id_nodo = models.ForeignKey(
        Nodo, 
        models.DO_NOTHING, 
        db_column='id_nodo'
    )
    fecha_hora = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'msg_flow_env'


class MsgFlowRec(models.Model):
    id = models.AutoField(primary_key=True)    
    id_flow = models.ForeignKey(
        Flow, 
        models.DO_NOTHING, 
        db_column='id_flow'
    )
    msg = models.TextField()
    fecha_hora = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'msg_flow_rec'


class TurnoFlow(models.Model):
    id = models.AutoField(primary_key=True)   
    id_turno = models.ForeignKey(Turno, models.DO_NOTHING, db_column='id_turno')
    id_flow = models.ForeignKey(Flow, models.DO_NOTHING, db_column='id_flow')

    class Meta:
        managed = False
        db_table = 'turno_flow'