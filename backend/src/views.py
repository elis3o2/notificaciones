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
from src.models import (Plantilla,  EstadoMsj, EstadoTurno, Turno, TurnoEspera,
                        Mensaje, Efector,Servicio, Especialidad, EfeSerEspPlantilla,
                        EfeSerEsp)

from src.serializers import(PlantillaSerializer, EstadoMsjSerializer, EstadoTurnoSerializer,
                TurnoSerializer, TurnoEsperaSerializer, MensajeSerializer,
                EfectorSerializer, ServicioSerializer,EspecialidadSerializer, EfeSerEspPlantillaSerializer, EfeSerEspPlantillaDetailSerializer,
                CustomTokenObtainPairSerializer,  TurnoMergedSerializer, HistoricoPacienteSerializer, 
                PacienteSerializer, ProfesionalSerializer, EfeSerEspSerializer, EfeSerEspEfectorSerializer,
                EfeSerEspCompletoSerializer, TurnoEsperaCreateSerializer, TurnoEsperaCloseSerializer )

from src.utils import enviar_whatsapp, get_actual_state, fetch_paciente, fetch_profesional
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
        qs = super().get_queryset()
        rp = self.request.query_params

        servicios = self._parse_csv_param('id_servicio')
        especialidades = self._parse_csv_param('id_especialidad')
        efectores = self._parse_csv_param('efectores') or self._parse_csv_param('id_efector')

        id_estado = rp.get('id_estado')
        if id_estado not in (None, ''):
            try:
                qs = qs.filter(id_estado=int(id_estado))
            except ValueError:
                pass

        if servicios:
            qs = qs.filter(id_efe_ser_esp__id_servicio__in=servicios)
        if especialidades:
            qs = qs.filter(id_efe_ser_esp__id_especialidad__in=especialidades)
        if efectores:
            qs = qs.filter(id_efe_ser_esp__id_efector__in=efectores)

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

    def get_queryset(self):
        qs = super().get_queryset()
        id_servicio = self.request.query_params.get("id_servicio")
        if id_servicio:
            qs = qs.filter(id_servicio=id_servicio)
        return qs

class EfeSerEspViewSet(viewsets.ModelViewSet):
    queryset = EfeSerEsp.objects.all()
    serializer_class = EfeSerEspSerializer

    @action(detail=False, methods=["get"], url_path="servicios")
    def servicios_por_efector(self, request):
        id_efector = request.query_params.get("id_efector")

        if not id_efector:
            return Response(
                {"detail": "Debe enviar id_efector como query param"},
                status=400
            )

        # Filtramos por efector
        queryset = self.get_queryset().filter(id_efector=id_efector)

        # Armamos la lista [{id: X, nombre: Y}, ...]
        servicios = [
            {"id": item["id_servicio"], "nombre": item["id_servicio__nombre"]}
            for item in queryset.values("id_servicio", "id_servicio__nombre").distinct()
        ]

        return Response(servicios)


    @action(detail=False, methods=["get"], url_path="efectores")
    def get_efectores(self, request):
        id_servicio = request.query_params.get("id_ser")
        id_especialidad = request.query_params.get("id_esp")

        queryset = self.get_queryset()

        try:
            if id_especialidad:
                queryset = queryset.filter(id_especialidad=int(id_especialidad))
            if id_servicio:
                queryset = queryset.filter(id_servicio=int(id_servicio))
        except ValueError:
            return Response(
                {"detail": "Parámetros inválidos. 'id_ser' e 'id_esp' deben ser enteros."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EfeSerEspEfectorSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=["get"], url_path="id")
    def get_id(self, request):
        id_efector = request.query_params.get("efector")
        id_servicio = request.query_params.get("servicio")
        id_especialidad = request.query_params.get("especialidad")
        
        if not id_efector or not id_servicio or not id_especialidad:
            return Response(
                {"detail": "Faltan datos"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.get_queryset()

        try:
            queryset = queryset.get(
                id_efector=int(id_efector),
                id_servicio=int(id_servicio),
                id_especialidad=int(id_especialidad),
            )
        except ValueError:
            return Response(
                {"detail": "Parámetros inválidos. 'efector', 'servicio' y 'especialidad' deben ser enteros."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EfeSerEspCompletoSerializer(queryset)
        return Response(serializer.data, status=status.HTTP_200_OK)




class EfeSerEspPlantillaViewSet(viewsets.ModelViewSet):
    queryset = EfeSerEspPlantilla.objects.all()
    serializer_class = EfeSerEspPlantillaDetailSerializer

    @action(detail=False, methods=["get"], url_path="buscar")
    def search(self, request):
        id_efector = request.query_params.get("id_efector")
        id_servicio = request.query_params.get("id_servicio")

        queryset = self.get_queryset()
        if id_efector:
            queryset = queryset.filter(id_efe_ser_esp__id_efector=id_efector)
        if id_servicio:
            queryset = queryset.filter(id_efe_ser_esp__id_servicio=id_servicio)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="detalle")
    def search_detalle(self, request):
        id_efector = request.query_params.get("id_efector")
        id_servicio = request.query_params.get("id_servicio")

        queryset = self.get_queryset()
        if id_efector:
            queryset = queryset.filter(id_efe_ser_esp__id_efector=id_efector)
        if id_servicio:
            queryset = queryset.filter(id_efe_ser_esp__id_servicio=id_servicio)

        queryset = queryset.select_related(
            "id_efe_ser_esp",
            "plantilla_conf",
            "plantilla_repr",
            "plantilla_canc",
            "plantilla_reco",
        ).order_by("id_efe_ser_esp__id_especialidad__nombre")

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class TurnoEsperaViewSet(viewsets.ModelViewSet):
    queryset = TurnoEspera.objects.all()
    serializer_class = TurnoEsperaSerializer

    @action(detail=False, methods=["get"], url_path="espera")
    def search_detalle(self, request):
        id_efector = request.query_params.get("id_efector")

        queryset = self.get_queryset()
        queryset = queryset.filter(id_estado=0)
        if id_efector:
            queryset = queryset.filter(id_efe_ser_esp__id_efector=id_efector)


        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"], url_path="paciente")
    def search_paciente(self, request):
        id_paciente = request.query_params.get("id")

        queryset = self.get_queryset()
        if id_paciente:
            queryset = queryset.filter(id_paciente=id_paciente)


        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        # 1. Usa tu serializer de creación (que setea usuario y fecha automáticamente)
        serializer = TurnoEsperaCreateSerializer(
            data=request.data, 
            context={"request": request}   # para poder acceder a request.user en el serializer
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        out = TurnoEsperaSerializer(instance, context={"request": request})

        return Response(out.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=["post"], url_path="close")
    def close_turno(self, request):
        id = request.query_params.get("id")
        turno = self.get_queryset().get(pk=id)
        serializer = TurnoEsperaCloseSerializer(
            turno,
            data={},  # no hace falta pasar nada más
            context={"request": request},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            TurnoEsperaSerializer(turno, context={"request": request}).data,
            status=status.HTTP_200_OK
        )

        


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


# ---------- API para búsquedas NO por id (retorna listas) ----------
class GetPacienteAPIView(APIView):
    """
    GET /api/pacientes/?dni=...&nombre=...&apellido=...
    Si se pasa 'id' devuelve solo un objeto (como mejora; pero preferimos usar GetPacienteDetail para id).
    Aquí se usa para búsquedas por filtros (no-id).
    """
    def get(self, request):
        id_persona = request.query_params.get('id')
        dni = request.query_params.get('dni')


        try:
            if id_persona:
                # si se pasa id devolvemos UN solo objeto
                paciente = fetch_paciente(id_persona=int(id_persona))
                if not paciente:
                    return Response({}, status=status.HTTP_404_NOT_FOUND)
                ser = PacienteSerializer(instance=paciente)
                return Response(ser.data, status=status.HTTP_200_OK)

            # búsqueda por filtros (al menos uno requerido)
            if not (dni):
                return Response({"detail": "Al menos uno de los parámetros (dni, nombre, apellido) es requerido para la búsqueda."},
                                status=status.HTTP_400_BAD_REQUEST)

            pacientes = fetch_paciente(dni=dni)
            ser = PacienteSerializer(instance=pacientes, many=True)
            return Response(ser.data, status=status.HTTP_200_OK)

        except DatabaseError:
            logger.exception("Error consultando pacientes")
            return Response({"detail": "Error al consultar la base de datos."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception:
            logger.exception("Error inesperado en GetPacienteAPIView")
            return Response({"detail": "Error interno."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GetProfesionalAPIView(APIView):
    """
    GET /api/profesionales/?id=...  OR ?id_efe=...&nombre=...&apellido=...
    Si se pasa id devuelve un único profesional; si no, devuelve todos los que coincidan con id_efe y filtros.
    """
    def get(self, request):
        try:
            id_prof = request.query_params.get('id')
            id_efector = request.query_params.get('id_efector')
            nombre = request.query_params.get('nombre')
            apellido = request.query_params.get('apellido')

            if id_prof:
                prof = fetch_profesional(id_prof=int(id_prof))
                if not prof:
                    return Response({}, status=status.HTTP_404_NOT_FOUND)
                ser = ProfesionalSerializer(instance=prof)
                return Response(ser.data, status=status.HTTP_200_OK)

            # búsqueda por efector (requerido si no hay id)
            if not id_efector:
                return Response({"detail": "Parámetro 'id_efe' requerido para búsqueda sin id."},
                                status=status.HTTP_400_BAD_REQUEST)

            profs = fetch_profesional(id_efector=int(id_efector), nombre=nombre, apellido=apellido)
            ser = ProfesionalSerializer(instance=profs, many=True)
            return Response(ser.data, status=status.HTTP_200_OK)

        except DatabaseError:
            logger.exception("Error consultando profesionales")
            return Response({"detail": "Error al consultar la base de datos."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception:
            logger.exception("Error inesperado en GetProfesionalAPIView")
            return Response({"detail": "Error interno."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



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
                        name_py = str(c[0])
                        cols.append(name_py.lower())

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
                col = cols[i]
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
                qs = Turno.objects.select_related("id_efe_ser_esp").filter(id__in=ids_int)
                # map para reordenar según ids_order
                local_map = {str(obj.id): obj for obj in qs}
                local_list = [local_map[i] for i in ids_order if i in local_map]
            else:
                qs = Turno.objects.select_related("id_efe_ser_esp").order_by('-fecha', '-hora')
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
