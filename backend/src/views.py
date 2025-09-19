from rest_framework import viewsets
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from decouple import config
from django.db.models import Count, Sum
from django.db.models.functions import Coalesce
from django.conf import settings
from django.db import connections, DatabaseError
from django.core.cache import cache
from src.models import (Plantilla,  EstadoMsj, EstadoTurno,
                Turno, Mensaje, Efector,Servicio, Especialidad, EfectorPlantilla)

from src.serializers import(PlantillaSerializer, EstadoMsjSerializer, EstadoTurnoSerializer,
                TurnoSerializer, MensajeSerializer, EfectorSerializer, ServicioSerializer,
                EspecialidadSerializer, EfectorPlantillaSerializer, EfectorPlantillaDetailSerializer,
                CustomTokenObtainPairSerializer,  TurnoMergedSerializer, HistoricoPacienteSerializer)
from src.utils import enviar_whatsapp, get_actual_state
import logging
logger = logging.getLogger(__name__)

class PlantillaViewSet(viewsets.ModelViewSet):
    queryset = Plantilla.objects.all()
    serializer_class = PlantillaSerializer


    def get_queryset(self):
        queryset = super().get_queryset()
        id_tipo = self.request.query_params.get("id_tipo")
        if id_tipo:
            queryset = queryset.filter(id_tipo=id_tipo)
        return queryset


class EstadoMsjViewSet(viewsets.ModelViewSet):
    queryset = EstadoMsj.objects.all()
    serializer_class = EstadoMsjSerializer

class EstadoTurnoViewSet(viewsets.ModelViewSet):
    queryset = Plantilla.objects.all()
    serializer_class = EstadoTurnoSerializer

class EstadoTurnoViewSet(viewsets.ModelViewSet):
    queryset = EstadoTurno.objects.all()
    serializer_class = EstadoTurnoSerializer

class TurnoViewSet(viewsets.ModelViewSet):
    queryset = Turno.objects.all()
    serializer_class = TurnoSerializer

    def _parse_csv_param(self, name: str):
        """
        Devuelve una lista de ints a partir de un query param tipo '1,2,3'
        o None si no existe / no hay valores válidos.
        Ignores non-integer values (para ser tolerante).
        """
        val = self.request.query_params.get(name)
        if not val:
            return None
        parts = [p.strip() for p in val.split(',') if p.strip() != ""]
        nums = []
        for p in parts:
            try:
                nums.append(int(p))
            except ValueError:
                # ignorar valores no convertibles para evitar 400s innecesarios
                continue
        return nums if nums else None

    def get_queryset(self):
        """
        Filtrado flexible y retrocompatible:
        - id_servicio, id_especialidad: aceptan csv o un único valor
        - efectores o id_efector: aceptan csv o único valor
        - id_estado: valor único (mantengo comportamiento original)
        """
        qs = super().get_queryset()
        rp = self.request.query_params

        servicios = self._parse_csv_param('id_servicio')            # p.ej. '1,2'
        especialidades = self._parse_csv_param('id_especialidad')  # p.ej. '3,4'
        # aceptamos tanto 'efectores' (nuevo) como 'id_efector' (posible uso anterior)
        efectores = self._parse_csv_param('efectores') or self._parse_csv_param('id_efector')

        id_estado = rp.get('id_estado')
        if id_estado is not None and id_estado != '':
            try:
                qs = qs.filter(id_estado=int(id_estado))
            except ValueError:
                # si viene mal formado, lo ignoramos (para no romper llamadas existentes)
                pass

        if servicios:
            qs = qs.filter(id_servicio__in=servicios)
        if especialidades:
            qs = qs.filter(id_especialidad__in=especialidades)
        if efectores:
            qs = qs.filter(id_efector__in=efectores)

        return qs


    @action(detail=False, methods=["get"], url_path="count")
    def count(self, request):
        """
        Devuelve un JSON con el conteo de turnos según los filtros pasados,
        y además el conteo de cuántos tienen activadas las banderas:
          - msj_recordatorio
          - msj_cancelacion
          - msj_reprogramacion
          - msj_confirmacion

        Ejemplo:
          GET /turnos/count/?id_estado=0&id_servicio=1,2&efectores=5,7
        """
        qs = self.filter_queryset(self.get_queryset())  # aplica filtros DRF si los hay

        agg = qs.aggregate(
            total=Count('pk'),
            recordatorios=Coalesce(Sum('msj_recordatorio'), 0),
            cancelaciones=Coalesce(Sum('msj_cancelado'), 0),
            reprogramaciones=Coalesce(Sum('msj_reprogramado'), 0),
            confirmaciones=Coalesce(Sum('msj_confirmado'), 0),
        )

        # Asegurarnos de devolver enteros (Coalesce ya lo hace, pero por seguridad)
        result = {
            "count": int(agg.get("total", 0) or 0),
            "msj_recordatorio": int(agg.get("recordatorios", 0) or 0),
            "msj_cancelacion": int(agg.get("cancelaciones", 0) or 0),
            "msj_reprogramacion": int(agg.get("reprogramaciones", 0) or 0),
            "msj_confirmacion": int(agg.get("confirmaciones", 0) or 0),
        }

        return Response(result)

class MensajeViewSet(viewsets.ModelViewSet):
    queryset = Mensaje.objects.all()
    serializer_class = MensajeSerializer

class EfectorViewSet(viewsets.ModelViewSet):
    queryset = Efector.objects.all()
    serializer_class = EfectorSerializer

class ServicioViwSet(viewsets.ModelViewSet):
    queryset = Servicio.objects.all()
    serializer_class = ServicioSerializer

class EspecialidadViewSet(viewsets.ModelViewSet):
    queryset = Especialidad.objects.all()
    serializer_class = EspecialidadSerializer


class EfectorPlantillaViewSet(viewsets.ModelViewSet):
    queryset = EfectorPlantilla.objects.all()
    serializer_class = EfectorPlantillaSerializer

    @action(detail=False, methods=["get"], url_path="buscar")
    def search(self, request):
        id_efector = request.query_params.get('id_efector')
        id_servicio = request.query_params.get('id_servicio')

        queryset = self.get_queryset()

        if id_efector:
            queryset = queryset.filter(id_efector=id_efector)

        if id_servicio:
            queryset = queryset.filter(id_servicio=id_servicio)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="servicios")
    def search_servicio(self, request):
        id_efector = request.query_params.get('id_efector')

        if not id_efector:
            return Response({"error": "Se requiere id_efector"}, status=400)

        servicios = (
            EfectorPlantilla.objects
            .filter(id_efector=id_efector)
            .values("id_servicio", "id_servicio__nombre")
            .distinct()
            .order_by("id_servicio__nombre")
        )
        servicios_limpios = [{"id": s["id_servicio"], "nombre": s["id_servicio__nombre"]} for s in servicios]
        return Response(servicios_limpios)
    
    
    @action(detail=False, methods=["get"], url_path="detalle")
    def search_detalle(self, request):
        id_efector = request.query_params.get('id_efector')
        id_servicio = request.query_params.get('id_servicio')

        queryset = self.get_queryset()

        if id_efector:
            queryset = queryset.filter(id_efector=id_efector)

        if id_servicio:
            queryset = queryset.filter(id_servicio=id_servicio)

        # aplico select_related para que haga join en una sola query
        queryset = queryset.select_related(
            "id_especialidad",
            "plantilla_conf",
            "plantilla_repr",
            "plantilla_canc",
            "plantilla_reco",
        )
    
        queryset = queryset.order_by('id_especialidad__nombre')


        serializer = EfectorPlantillaDetailSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer




class SendWSP(APIView):
    def post(self, request, *args, **kwargs):
        # Obtener parámetros del cuerpo de la solicitud
        numero = request.data.get('numero')
        msj = request.data.get('mensaje')

        # Validar que existan ambos parámetros
        if not numero or not msj:
            return Response(
                {'error': 'Se requieren numero y mensaje en el cuerpo de la solicitud'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return enviar_whatsapp(numero, msj)



class GetEstadoMSJ(APIView):
    def post(self, request, *args, **kwargs):
        id = request.data.get('id')
        id_mensaje = request.data.get('id_mensaje')
        numero = request.data.get('numero')

        if not id or not id_mensaje or not numero:
            return Response(
                {'error': 'Faltan datos'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return get_actual_state(id, id_mensaje, numero)

class HistoricoPaciente(APIView):
    def get(self, request):
        dni = request.query_params.get('dni')
        if not dni:
            return Response({"detail": "Parámetro 'dni' requerido."}, status=status.HTTP_400_BAD_REQUEST)

        sql = """
                    (
            SELECT 
                th.idturno, 
                th.fecha_hora_mdf, 
                es.descripcion AS estado,
                TRIM(per.nombre_per) AS paciente_nombre, 
                TRIM(per.apellido) AS paciente_apellido,
                per.nro_doc, 
                TRIM(p.nombre) AS nombre_profesional, 
                TRIM(p.apellido) AS apellido_profesional,
                t.fecha, 
                t.hora,
                efe.nombre AS efector, 
                s.descripcion AS servicio, 
                esp.descripcion AS especialidad
            FROM turnos_historico th
            JOIN turnos t ON th.idturno = t.idturno
            JOIN turnos_estado es on es.idestadoturno = th.idestadoturno
            JOIN personalefector pe ON pe.idpersonalefector = t.idpersonalefector
            JOIN personal p ON p.idpersonal = pe.idpersonal
            JOIN efectores efe ON efe.idefector = pe.idefector
            JOIN efectorservesp ese ON ese.idefecservesp = t.idefecservesp
            JOIN especialidadesserv se ON se.idespecialidadserv = ese.idespecialidadserv
            JOIN servicios s ON s.idservicio = se.idservicio
            JOIN especialidades esp ON esp.idespecialidad = se.idespecialidad
            JOIN v_personas per ON per.id_persona = t.idpaciente
            WHERE per.nro_doc = ?
        )
        UNION ALL
        (
            SELECT 
                te.idturno, 
                te.fecha_hora_elim AS fecha_hora_mdf,
                'ELIMINADO' AS estado,
                TRIM(per.nombre_per) AS paciente_nombre, 
                TRIM(per.apellido) AS paciente_apellido,
                per.nro_doc, 
                TRIM(p.nombre) AS nombre_profesional, 
                TRIM(p.apellido) AS apellido_profesional,
                te.fecha, 
                te.hora,
                efe.nombre AS efector, 
                s.descripcion AS servicio, 
                esp.descripcion AS especialidad
            FROM turnos_respaldo_eliminado te
            JOIN personalefector pe ON pe.idpersonalefector = te.idpersonalefector
            JOIN personal p ON p.idpersonal = pe.idpersonal
            JOIN efectores efe ON efe.idefector = pe.idefector
            JOIN efectorservesp ese ON ese.idefecservesp = te.idefecservesp
            JOIN especialidadesserv se ON se.idespecialidadserv = ese.idespecialidadserv
            JOIN servicios s ON s.idservicio = se.idservicio
            JOIN especialidades esp ON esp.idespecialidad = se.idespecialidad
            JOIN v_personas per ON per.id_persona = te.idpaciente
            WHERE per.nro_doc = ?
        )
        ORDER BY fecha_hora_mdf DESC
        """

        try:
            with connections['informix'].cursor() as cur:
                cur.execute(sql, (dni, dni))
                rows = cur.fetchall()

                # Si no hay filas, devolvemos array vacío (evitamos operar sobre cur.description None)
                if not rows:
                    return Response([], status=status.HTTP_200_OK)

                # cur.description puede tener varias formas según el driver.
                # Hacemos una extracción tolerante a formatos:
                cols = []
                desc = cur.description
                if desc:
                    for c in desc:
                        # Algunos drivers devuelven (name, type_code, ...) como tuplas,
                        # otros devuelven directamente un objeto java.lang.String.
                        try:
                            # intentar obtener primer elemento (DB-API estándar)
                            name = c[0]
                        except Exception:
                            # si falla (p. ej. c es java.lang.String), usar c directamente
                            name = c
                        # forzamos a str de Python (esto llama a toString() si es objeto Java)
                        name_py = str(name)
                        cols.append(name_py.lower())
                else:
                    # Por si description es None, creamos nombres genericos
                    cols = [f'col_{i}' for i in range(len(rows[0]))]

        except DatabaseError:
            logger.exception("Error consultando Informix")
            return Response({"detail": "Error al consultar la base de datos Informix."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception:
            logger.exception("Error inesperado")
            return Response({"detail": "Error interno."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Convertir a lista de dicts manteniendo objetos datetime (para que DRF los serialice correctamente).
        result = []
        for r in rows:
            item = {}
            for i, v in enumerate(r):
                col = cols[i] if i < len(cols) else f'col_{i}'
                # decodificar bytes si corresponden
                if isinstance(v, (bytes, bytearray)):
                    try:
                        v = v.decode('utf-8', errors='ignore')
                    except Exception:
                        v = str(v)
                # Normalizar fechas/datetimes a ISO para evitar problemas de serialización
                try:
                    from datetime import date, datetime
                    if isinstance(v, (datetime, date)):
                        v = v.isoformat()
                except Exception:
                    pass
                item[col] = v
            result.append(item)

        # Serializamos para normalizar salida y que DRF formatee fechas automáticamente
        serializer = HistoricoPacienteSerializer(instance=result, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)



class TurnosMergedAllAPIView(APIView):

    def get(self, request):
        # Si el cliente pasó ?ids=1,2,3 -> usar esa lista. Si no, traer TODO.
        ids_param = request.query_params.get('ids')
        cantidad_param = request.query_params.get('cantidad')  # nuevo: cantidad a devolver
        ids_order = None  # mantendrá el orden solicitado por el cliente (si aplica)
        cantidad = None

        # validar parametro cantidad si existe
        if cantidad_param:
            try:
                cantidad = int(cantidad_param)
                if cantidad <= 0:
                    raise ValueError()
            except ValueError:
                return Response(
                    {"detail": "Parámetro 'cantidad' inválido. Debe ser un entero positivo."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # 1) Traer Turno instances con select_related (no usamos .values())
        try:
            if ids_param:
                try:
                    # mantenemos ids como strings para la reordenación posterior
                    ids_order = [str(int(x.strip())) for x in ids_param.split(',') if x.strip() != '']
                except ValueError:
                    return Response(
                        {"detail": "Parámetro 'ids' inválido. Debe ser una lista de enteros separados por coma."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # si se pidió una cantidad, truncamos el orden de ids antes de convertir a int
                if cantidad is not None:
                    ids_order = ids_order[:cantidad]

                # Convertimos a enteros para el filtro
                ids_int = [int(x) for x in ids_order]

                # traemos instancias y relaciones necesarias
                qs = Turno.objects.select_related("id_efector", "id_servicio", "id_especialidad").filter(id__in=ids_int)
                # map para reordenar según ids_order
                local_map = {str(obj.id): obj for obj in qs}
                local_list = [local_map[i] for i in ids_order if i in local_map]
            else:
                qs = Turno.objects.select_related("id_efector", "id_servicio", "id_especialidad").order_by('-fecha', '-hora')
                local_list = list(qs)

                # aplicar cantidad cuando no se pasaron ids
                if cantidad is not None:
                    local_list = local_list[:cantidad]

            if not local_list:
                return Response([], status=status.HTTP_200_OK)

        except Exception:
            logger.exception("Error al obtener turnos locales")
            return Response({"detail": "Error interno al obtener turnos."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 2) Normalizar ids para la consulta a Informix (igual que venías haciendo)
        ids_list = [str(t.id) for t in local_list]

        # 3) Consultar Informix igual que tenías, poblar ext_map
        ext_map = {}
        try:
            with connections['informix'].cursor() as cur:
                
                if len(ids_list) == 1:
                    where_clause1 = "WHERE t.idturno = ?"
                    where_clause2 = "WHERE te.idturno = ?"
                else:
                    placeholders = ",".join(["?"] * len(ids_list))
                    where_clause1 = f"WHERE t.idturno IN ({placeholders})"
                    where_clause2 = f"WHERE te.idturno IN ({placeholders})"


                sql = f"""
                    (SELECT t.idturno, TRIM(per.nombre_per) AS paciente_nombre, TRIM(per.apellido) AS paciente_apellido,
                    per.nro_doc, TRIM(p.nombre) AS nombre_profesional, TRIM(p.apellido) AS apellido_profesional
                    FROM turnos t
                    JOIN personalefector pe ON pe.idpersonalefector = t.idpersonalefector
                    JOIN personal p ON p.idpersonal = pe.idpersonal
                    JOIN v_personas per ON per.id_persona = t.idpaciente           
                    {where_clause1})
                    UNION ALL
                    (SELECT te.idturno, TRIM(per.nombre_per) AS paciente_nombre, TRIM(per.apellido) AS paciente_apellido,
                    per.nro_doc, TRIM(p.nombre) AS nombre_profesional, TRIM(p.apellido) AS apellido_profesional
                    FROM turnos_respaldo_eliminado te
                    JOIN personalefector pe ON pe.idpersonalefector = te.idpersonalefector
                    JOIN personal p ON p.idpersonal = pe.idpersonal
                    JOIN v_personas per ON per.id_persona = te.idpaciente           
                    {where_clause2})                
                """

                cur.execute(sql, ids_list*2)
                rows = cur.fetchall()
                for row in rows:
                    turno_id = str(row[0])
                    ext_map[turno_id] = {
                        'paciente_nombre': row[1],
                        'paciente_apellido': row[2],
                        'paciente_dni': row[3],
                        'profesional_nombre': row[4],
                        'profesional_apellido': row[5],
                    }

        except DatabaseError:
            logger.exception("Error consultando Informix")
            # no detenemos la ejecución: seguimos y serializamos con campos informix en None si falla
        except Exception:
            logger.exception("Error inesperado consultando Informix")

        # 4) Inyectar los campos de Informix como atributos dinámicos sobre cada instancia Turno
        for turno in local_list:
            ext = ext_map.get(str(turno.id), {})
            # si no existe la key, devolvemos None (coherente con tus campos allow_null)
            setattr(turno, 'paciente_nombre', ext.get('paciente_nombre'))
            setattr(turno, 'paciente_apellido', ext.get('paciente_apellido'))
            setattr(turno, 'paciente_dni', ext.get('paciente_dni'))
            setattr(turno, 'profesional_nombre', ext.get('profesional_nombre'))
            setattr(turno, 'profesional_apellido', ext.get('profesional_apellido'))

        # 5) Serializar y devolver. Como le pasamos instancias Turno, los campos nested funcionarán.
        serializer = TurnoMergedSerializer(local_list, many=True)
        return Response(serializer.data)
