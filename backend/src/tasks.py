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
                        Especialidad, EfeSerEsp)
from src.utils import enviar_whatsapp, check_turno, format_plantilla

TZ = ZoneInfo("America/Argentina/Buenos_Aires")



def make_query(size):
    """
    Query base para obtener detalles de un turno.
    Usa placeholder (?) para el idturno.
    """
    if size == 1:
        where_clause = "WHERE tur.idturno = ?"
    else:
        placeholders = ",".join(["?"] * size)
        where_clause = f"WHERE tur.idturno IN ({placeholders})"

    return f"""
    SELECT
        tur.idturno,
        efe.idefector,
        s.idservicio,
        esp.idespecialidad,
        tur.idefecservesp,
        tdoc.abrev_doc AS tipoDoc,
        per.nro_doc AS nroDoc,
        TRIM(per.apellido) AS apePac,
        TRIM(per.nombre_per) AS nomPac,
        tur.fecha AS fechaTurno,
        tur.hora AS horaTurno,
        TRIM(p.apellido) AS apeProf,
        TRIM(p.nombre) AS nomProf,
        s.descripcion AS servicio,
        esp.descripcion AS especialidad,
        efe.nombre AS efector,
        TRIM(efe.nomcalle) AS calleEfe,
        efe.numero AS alturaCalleEfe,
        efe.letracalle AS letraCalleEfe,
        efe.coordenadax AS coordXEfe,
        efe.coordenaday AS coordYEfe,
        efe.telefono AS telEfe,
        TRIM(calle.nom_calle) AS calleEfeV_calles,
        TRIM(per.carac_telef) AS caracTelPacV_personas,
        CAST(per.nro_telef AS VARCHAR(13)) AS telPacV_personas
    FROM turnos tur
    JOIN personalefector pe ON pe.idpersonalefector = tur.idpersonalefector
    JOIN personal p ON p.idpersonal = pe.idpersonal
    JOIN efectores efe ON efe.idefector = pe.idefector
    JOIN efectorservesp ese ON ese.idefecservesp = tur.idefecservesp
    JOIN especialidadesserv se ON se.idespecialidadserv = ese.idespecialidadserv
    JOIN servicios s ON s.idservicio = se.idservicio
    JOIN especialidades esp ON esp.idespecialidad = se.idespecialidad
    JOIN v_personas per ON per.id_persona = tur.idpaciente
    JOIN v_tipo_doc tdoc ON tdoc.cod_doc = per.cod_doc
    LEFT JOIN v_calles calle ON calle.cod_calle = efe.cod_calle
    {where_clause}
    """


def make_query2(size):
    if size == 1:
        where_clause = "WHERE th.idturasghistorico = ?"
    else:
        placeholders = ",".join(["?"] * size)
        where_clause = f"WHERE th.idturasghistorico IN ({placeholders})"

    return f""""
    SELECT
        efe.idefector as idefector,
        ser.ser as cod_ser_dtt,
        trim(prf.nom) as prof,
        trim(ser.nom) as servicio,
        tdoc.abrev_doc as tipoDoc,
        per.nro_doc as nroDoc,
        trim(per.apellido) as apePac,
        trim(per.nombre_per) as nomPac,
        extend(th.fechahora_turno, year to day) as fechaTurno,
        extend(th.fechahora_turno, hour to minute) as horaTurno,
        efe.nombre as efector,
        trim(efe.nomcalle) as calleEfe,
        efe.numero as alturaCalleEfe,
        efe.letracalle as letraCalleEfe,
        efe.coordenadax as coordXEfe,
        efe.coordenaday as coordYEfe,
        efe.telefono as telEfe,
        trim(per.carac_telef) as caracTelPacV_personas,
        cast(per.nro_telef as varchar(20)) as telPacV_personas
    FROM turnosdtt_historico th
    JOIN hcsindividuales h
    ON h.nrohci = rpad(trim(th.hc_paciente),10,' ')
    JOIN pacientes pac
    ON pac.idhistind = h.idhistind
    JOIN v_personas per
    ON per.id_persona = pac.idpaciente
    JOIN v_tipo_doc tdoc
    ON tdoc.cod_doc = per.cod_doc
    JOIN hos:turasg tur
    ON tur.prf = th.cod_prf
    AND tur.fec = th.fechahora_turno
    JOIN hos:turcns cns
    ON cns.cns = tur.cns
    JOIN efectores efe
    ON efe.codigo = cns.efe
    JOIN hos:cliser ser
    ON ser.ser = tur.ser
    JOIN hos:cliprf prf
    ON prf.prf = th.cod_prf
    {where_clause}
    """

def query_persona():
    return """
    SELECT 
        TRIM(per.apellido) AS apePac,
        TRIM(per.nombre_per) AS nomPac,
        TRIM(per.carac_telef) AS caracTelPacV_personas,
        CAST(per.nro_telef AS VARCHAR(13)) AS telPacV_personas
    FROM v_personas per
    WHERE per.id_persona = ?
    """

def query_efector():
    return """
    SELECT 
        efe.nombre AS efector,
        TRIM(efe.nomcalle) AS calleEfe,
        efe.numero AS alturaCalleEfe,
        efe.letracalle AS letraCalleEfe,
        efe.coordenadax AS coordXEfe,
        efe.coordenaday AS coordYEfe,
        efe.telefono AS telEfe,
        TRIM(calle.nom_calle) AS calleEfeV_calles
    FROM efectores efe
    LEFT JOIN v_calles calle ON calle.cod_calle = efe.cod_calle
    WHERE efe.idefector = ?
    """


def parse_date(value):
    if value is None:
        return None
    # si es datetime o date
    if isinstance(value, datetime):
        return value.date()
    try:
        # si ya es date-like
        from datetime import date as _date
        if isinstance(value, _date):
            return value
    except Exception:
        pass
    s = str(value).strip().split(".")[0]      # quitar fracciones si las trae
    if " " in s:
        s = s.split(" ")[0]
    # intentar formatos comunes
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            continue
    # último recurso: intentar partir por '-' (YYYY-M-D)
    try:
        parts = s.split("-")
        if len(parts) == 3:
            y, m, d = [int(p) for p in parts]
            return datetime.date(y, m, d)
    except Exception:
        pass
    return None

def parse_time(value):
    if value is None:
        return None
    if isinstance(value, time):
        return value
    if isinstance(value, datetime):
        return value.time()
    s = str(value).strip().split(".")[0]
    if " " in s:
        # tomar la parte que parece hora (ej: "Date ... 08:00:00")
        s = s.split(" ", 1)[-1]
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt).time()
        except Exception:
            continue
    return None


@shared_task
def verificar_turnos():
    print(f"[{timezone.now()}] Ejecutando verificación de turnos...")
    tz = pytz.timezone(settings.TIME_ZONE)
    # Obtener/crear LastMod (mantener aware si USE_TZ)
    try:
        last_mod_obj = LastMod.objects.first()
        if not last_mod_obj:
            lm0 = datetime(1970, 1, 1, 0, 0, 0)
            if settings.USE_TZ:
                lm0 = timezone.make_aware(lm0, timezone.get_default_timezone())
            last_mod_obj = LastMod.objects.create(fecha=lm0)
        last_mod_raw = last_mod_obj.fecha
    except Exception as e:
        print(f"[ERROR] al obtener/crear LastMod: {e}")
        return

    try:
        conn = connections['informix']
        with conn.cursor() as cur:
            lm_param = last_mod_raw.strftime("%Y-%m-%d %H:%M:%S")
            print(f"[DEBUG] Usando last_mod para consulta Informix: {lm_param!r}")

            try:
                cur.execute("""
                    SELECT idturno, idpaciente, idestadoturno, fecha_hora_mdf
                    FROM turnoshistorico
                    WHERE fecha_hora_mdf > ?
                    ORDER BY fecha_hora_mdf
                """, [lm_param])
            except Exception as ex:
                print(f"[ERROR] al ejecutar consulta de notificaciones con param {lm_param!r}: {ex}")
                return

            mejor_raw = None

            for r in cur.fetchall():
                print(f"[DEBUG] notificacion raw: {r}")
                idturno, idpaciente, idestadoturno, last_modf_val = r

                este_raw = str(last_modf_val).split(".")[0]
                if mejor_raw is None or este_raw > mejor_raw:
                    mejor_raw = este_raw

                # Mapeo de idestadoturno -> estado (restaurado al mapping esperado)
                if idestadoturno == 3:
                    estado = 1
                elif idestadoturno in (4, 5, 6):
                    estado = 4
                elif idestadoturno in (1, 2, 7):
                    estado = 2
                elif idestadoturno == 8:
                    estado = 3
                else:
                    continue

                # Si corresponde (0 o 3) traigo detalles completos
                detalles = None
                if estado in (1, 3):
                    try:
                        cur.execute(make_query(1), [idturno])
                        detalles = cur.fetchone()
                    except Exception as ex:
                        print(f"[ERROR] al ejecutar make_query() para idturno={idturno}: {ex}")
                        continue

                    if not detalles:
                        print(f"[DEBUG] No hay detalles para idturno={idturno}")
                        continue

                    (
                        _id_from_row, id_efector, id_servicio, id_especialidad, id_efe_ser_esp ,
                        tipo_doc, nro_doc, ape_pac, nom_pac, fecha_turno, hora_turno,
                        ape_prof, nom_prof, nombre_servicio, nombre_especialidad,
                        nombre_efector, calle, altura, letra, coordx, coordy,
                        tel_efe, calle_nom, carac_tel, tel
                    ) = detalles
                    # parsear
                    d_fecha = parse_date(fecha_turno)
                    d_hora = parse_time(hora_turno)

                    d_fecha = d_fecha.strftime("%d-%m-%Y")
                    d_hora = d_hora.strftime("%H:%M")

                    # formatear al formato pedido: '%d-%m-%Y' y '%H:%M'
                    fecha_literal = str(fecha_turno).split(" ")[0]

                    s_h = str(hora_turno).split(".")[0] 
                    if " " in s_h:
                        hora_literal = s_h.split(" ", 1)[1] 
                    else:
                        hora_literal = s_h

                    if estado == 1:
                        try:
                            Turno.objects.create(
                                id=idturno,
                                id_estado_id=estado,
                                msj_confirmado=0,
                                msj_reprogramado=0,
                                msj_cancelado=0,
                                msj_recordatorio=0,
                                id_efe_ser_esp_id=id_efe_ser_esp,
                                fecha=fecha_literal,
                                hora=hora_literal
                            )
                            print(f"[INFO] Creado Turno id={idturno} fecha={fecha_literal} hora={hora_literal}")
                        except Exception as ex:
                            print(f"[ERROR] al crear Turno id={idturno}: {ex}")
                            continue

                if estado in (2, 3, 4):
                    try:
                        filas_actualizadas = Turno.objects.filter(id=idturno).update(id_estado_id=estado)
                        if filas_actualizadas == 0:
                            print(f"[DEBUG] No existe Turno local con id={idturno} => se ignora notificación (estado={estado})")
                            continue

                        print(f"[INFO] Actualizado Turno id={idturno} a estado={estado} (filas_actualizadas={filas_actualizadas})")
                    except Exception as ex:
                        print(f"[ERROR] al actualizar Turno id={idturno}: {ex}")
                        continue

                    # Si estado == 2 (suspendido) traer persona + efector + enviar
                    if estado == 2:
                        try:
                            # obtener datos persona de forma segura
                            cur.execute(query_persona(), [idpaciente])
                            persona_row = cur.fetchone()
                            if persona_row:
                                ape_pac, nom_pac, carac_tel, tel = persona_row
                            else:
                                ape_pac = nom_pac = carac_tel = tel = None

                            # --- cambio mínimo: obtener id_efe_ser_esp desde Turno si no lo tenemos
                            id_efe_ser_esp = Turno.objects.filter(id=idturno).values_list("id_efe_ser_esp_id", flat=True).first()

                            # obtener EfeSerEsp para sacar efector/servicio/especialidad (asumimos que existe)
                            ese_obj = EfeSerEsp.objects.select_related(
                                "id_efector", "id_servicio", "id_especialidad"
                            ).get(pk=id_efe_ser_esp)

                            id_efector = ese_obj.id_efector_id
                            id_servicio = ese_obj.id_servicio_id
                            id_especialidad = ese_obj.id_especialidad_id

                            nombre_servicio = ese_obj.id_servicio.nombre if hasattr(ese_obj, "id_servicio") and ese_obj.id_servicio else None
                            nombre_especialidad = ese_obj.id_especialidad.nombre if hasattr(ese_obj, "id_especialidad") and ese_obj.id_especialidad else None

                            # datos del efector vía cursor Informix
                            nombre_efector = calle = altura = letra = coordx = coordy = tel_efe = calle_nom = None
                            if id_efector:
                                cur.execute(query_efector(), [id_efector])
                                ef_row = cur.fetchone()
                                if ef_row:
                                    (nombre_efector, calle, altura, letra,
                                    coordx, coordy, tel_efe, calle_nom) = ef_row

                            # obtener fecha/hora guardadas en Turno (siempre strings según create)
                            fecha_literal = Turno.objects.filter(id=idturno).values_list("fecha", flat=True).first()
                            hora_literal = Turno.objects.filter(id=idturno).values_list("hora", flat=True).first()

                            # intentar parsear sin hacer chequeos extra (cambio mínimo)
                            try:
                                d_fecha = parse_date(fecha_literal).strftime("%d-%m-%Y")
                            except Exception:
                                d_fecha = fecha_literal
                            try:
                                d_hora = parse_time(hora_literal).strftime("%H:%M")
                            except Exception:
                                d_hora = hora_literal

                            nom_prof = None
                            ape_prof = None
                        except Exception as ex:
                            print(f"[ERROR] al procesar estado 2 para idturno={idturno}: {ex}")
                            continue

                if estado == 4:
                    continue

                # Asegurar que id_efe_ser_esp esté definido antes de check_turno:
                if "id_efe_ser_esp" not in locals() or id_efe_ser_esp is None:
                    id_efe_ser_esp = Turno.objects.filter(id=idturno).values_list("id_efe_ser_esp_id", flat=True).first()

                telefono = None
                send, plantilla = check_turno(id_efe_ser_esp, estado)
                if send and plantilla:
                    if carac_tel and tel:
                        telefono = ("549" + str(carac_tel) + str(tel)).replace(" ", "")

                        datos_plantilla = {
                            "nompac": nom_pac or "",
                            "apepac": ape_pac or "",
                            "fecha": d_fecha,
                            "horaturno": d_hora,
                            "nomprof": nom_prof or "",
                            "apeprof": ape_prof or "",
                            "especialidad": nombre_especialidad or "",
                            "efector": nombre_efector or "",
                            "servicio": nombre_servicio or "",
                            "calle": calle or "",
                            "altura": altura or "",
                            "letra": letra or "",
                            "coordx": coordx or "",
                            "coordy": coordy or "",
                            "tel_efe": tel_efe or "",
                            "calle_nom": calle_nom or "",
                        }

                        mensaje = format_plantilla(plantilla.contenido, datos_plantilla)
                        res = enviar_whatsapp(telefono, mensaje)
                        response_data = getattr(res, "data", {}) or {}

                        if res.status_code == 503:
                            ack = -4
                        elif res.status_code == 400:
                            ack = -3
                        elif res.status_code == 404:
                            ack = -2
                        elif res.status_code == 500:
                            ack = -1
                        else:
                            ack = response_data.get("ack")

                        try:
                            Mensaje.objects.create(
                                id_mensaje=response_data.get("id", None),
                                id_turno_id=idturno,
                                numero=telefono,
                                id_plantilla=plantilla,
                                fecha_envio=datetime.now(),
                                id_estado_id=ack,
                            )
                        except Exception as ex:
                            print(f"[ERROR] al crear Mensaje para turno {idturno}: {ex}")
                            continue

                        if ack >= 0:  # actualizar flags en Turno
                            try:
                                if estado == 1:
                                    Turno.objects.filter(id=idturno).update(msj_confirmado=1)
                                elif estado == 2:
                                    Turno.objects.filter(id=idturno).update(msj_cancelado=1)
                                elif estado == 3:
                                    Turno.objects.filter(id=idturno).update(msj_reprogramado=1)
                            except Exception as ex:
                                print(f"[ERROR] al actualizar flags msj_* en Turno id={idturno}: {ex}")
                    else:
                        print(f"[DEBUG] No hay teléfono válido para idturno={idturno} (carac_tel={carac_tel}, tel={tel})")
                        try:
                            Mensaje.objects.create(
                                id_turno_id=idturno,
                                id_plantilla=plantilla,
                                numero=telefono,
                                fecha_envio=datetime.now(),
                                id_estado_id=-3,
                            )
                        except Exception as ex:
                            print(f"[ERROR] al crear Mensaje para turno {idturno}: {ex}")
                else:
                    print(f"[DEBUG] check_turno returned send={send}, plantilla={plantilla} for turno {idturno}")

            # Al final: actualizar LastMod con mejor_raw EXACTO (SQL directo en default_connection)
            try:
                if mejor_raw is None:
                    print("[DEBUG] No se encontró mejor_raw -> no se actualiza LastMod")
                else:
                    table_name = LastMod._meta.db_table
                    pk_col = LastMod._meta.pk.column
                    with default_connection.cursor() as cur2:
                        cur2.execute(
                            f"UPDATE {table_name} SET fecha = %s WHERE {pk_col} = %s",
                            [mejor_raw, last_mod_obj.pk]
                        )
                    print(f"[DEBUG] Actualizado LastMod.fecha EXACTO = {mejor_raw!r} (UPDATE directo)")
            except Exception as ex:
                print(f"[ERROR] al actualizar LastMod con SQL directo: {ex}")

    except Exception as e:
        print(f"[ERROR] Error en verificación de turnos: {e}")


@shared_task
def programar_recordatorios():
    
    print(f"[{timezone.now().isoformat()}] Ejecutando recordatorios...")        
    
    try:
        hoy = datetime.now().date()

        # Subquery: buscar la configuración activa que coincida por efector/servicio/especialidad
        efp_qs = (
            EfeSerEspPlantilla.objects
            .filter(
                id_efe_ser_esp=OuterRef('id_efe_ser_esp'),
                recordatorio=1
            )
        )

        # traemos turnos desde hoy hasta hoy + max_dias (si max_dias = 0, será sólo hoy)
        rango_fin = hoy + timedelta(days=5)

        turnos_qs = (
            Turno.objects
            .filter(id_estado=1, msj_recordatorio=0, fecha__range=(hoy, rango_fin))
            .annotate(
                efp_exists=Exists(efp_qs),
                plantilla_reco=Subquery(efp_qs.values('plantilla_reco')[:1]),
                dias_antes=Subquery(efp_qs.values('dias_antes')[:1]),
            )
            .filter(efp_exists=True)
            .order_by('fecha', 'hora')
            .values('id', 'id_efe_ser_esp',
                    'fecha', 'hora', 'dias_antes', 'plantilla_reco')
        )

        turnos = list(turnos_qs)
        if not turnos:
            print("No hay turnos candidatos para recordatorios.")
            return

        # Filtrar los que realmente correspondan: fecha - dias_antes == hoy
        candidatos = []
        for t in turnos:
            fecha: date = t['fecha']
            dias_antes = int(t['dias_antes'] or 0)
            if fecha - timedelta(days=dias_antes) == hoy:
                candidatos.append(t)

        if not candidatos:
            print("Ningún turno requiere recordatorio hoy.")
            return

        turnos_ids = [t['id'] for t in candidatos]
        turnos_map = {t["id"]: t for t in candidatos}

        conn = connections['informix']
        resultados = []
        if turnos_ids:
            with conn.cursor() as cur:
                cur.execute(make_query(len(turnos_ids)), turnos_ids)
                resultados = cur.fetchall()

        if not resultados:
            print("No se obtuvieron resultados desde Informix para los turnos solicitados.")
            return

        # distribuimos envíos para turnos en días futuros: evitar picos
        per_day_counter = defaultdict(int)
        now = timezone.now()

        tz = timezone.get_current_timezone()

        for r in resultados:
            try:
                (
                    id_turno ,id_efector, id_servicio, id_especialidad,
                    id_efe_ser_esp, tipo_doc, nro_doc,
                    ape_pac, nom_pac, fecha_turno_inf, hora_turno_inf,
                    ape_prof, nom_prof, nombre_servicio, nombre_especialidad,
                    nombre_efector, calle, altura, letra, coordx, coordy,
                    tel_efe, calle_nom, carac_tel, tel
                ) = r
            except Exception as ex:
                print(f"[WARN] Tuple de resultados con longitud inesperada: {ex} -> {r}")
                continue

            t_local = turnos_map.get(id_turno)
            if not t_local:
                print(f"[WARN] No se encontró turno local para id_turno={id_turno}")
                continue

            fecha_turno = t_local["fecha"]
            hora_turno = t_local["hora"]

            # construir send_dt de forma robusta (naive -> aware con make_aware usando tz válido)
            dt_naive = datetime.combine(fecha_turno, hora_turno)
            try:
                send_dt = make_aware(dt_naive, tz)
            except Exception as ex:
                # fallback: intentar replace sólo si tz es un tzinfo válido
                try:
                    send_dt = dt_naive.replace(tzinfo=tz)
                except Exception as ex2:
                    print(f"[ERROR] No se pudo crear send_dt aware para id_turno={id_turno}: {ex} / {ex2}")
                    continue  # saltamos este registro para evitar crash

            if fecha_turno == hoy:
                if hora_turno <= time(10, 30):
                    send_dt = send_dt - timedelta(hours=2)
                elif hora_turno <= time(13, 0):
                    send_dt = send_dt - timedelta(hours=3)
                else:
                    send_dt = send_dt - timedelta(hours=4)
            else:
                base_naive = datetime.combine(fecha_turno, time(10, 0))
                try:
                    base = make_aware(base_naive, tz)
                except Exception:
                    try:
                        base = base_naive.replace(tzinfo=tz)
                    except Exception:
                        print(f"[ERROR] No se pudo crear base aware para id_turno={id_turno}")
                        continue
                idx = per_day_counter[fecha_turno]
                send_dt = base + timedelta(seconds=120 * idx)
                per_day_counter[fecha_turno] += 1

            # comparar con now aware (y debug si algo raro pasa)
            now = timezone.now()
            if getattr(now, "tzinfo", None) is None:
                try:
                    now = make_aware(now, tz)
                except Exception:
                    pass

            if send_dt <= now:
                eta = now + timedelta(seconds=5)
            else:
                eta = send_dt
            try:
                send_reminder_task.apply_async(args=(list(map(str, r)),), eta=eta)
                print(f"Programado reminder para id_turno={id_turno} en {eta.isoformat()}")
            except Exception as ex:
                print(f"[ERROR] al programar send_reminder_task para id_turno={id_turno}: {ex}")

        print("Procesamiento de recordatorios completado")

    except Exception as e:
        print(f"Error en recordatorios: {str(e)}")


@shared_task
def send_reminder_task(detalles):
    """
    detalles: tupla con los campos que devuelve make_query (ver SELECT antes)
    id_turno: id del Turno que viene de la query
    """
    try:
        (
            id_turno,
            id_efector, id_servicio, id_especialidad,
            id_efe_ser_esp, tipo_doc, nro_doc,
            ape_pac, nom_pac, fecha_turno, hora_turno,
            ape_prof, nom_prof, nombre_servicio, nombre_especialidad,
            nombre_efector, calle, altura, letra, coordx, coordy,
            tel_efe, calle_nom, carac_tel, tel
        ) = detalles
    except Exception as ex:
        print(f"[ERROR] detalles inválidos para turno: {ex}")
        return


    try:
        turno = Turno.objects.filter(pk=id_turno).first()
        if not turno:
            print(f"[WARN] Turno {id_turno} no existe.")
            return

        # Si el turno cambió de estado o ya tiene recordatorio, no enviamos
        if turno.id_estado_id != 1 or turno.msj_recordatorio == 1:
            print(f"Cambio de estado o ya enviado para turno {id_turno}, abortando envío.")
            return


        # comprobar si aún corresponde (ej: chequeos de configuración dinámica)
        send_flag, plantilla = check_turno(id_efe_ser_esp, 4)
        if not send_flag or not plantilla:
            print(f"[DEBUG] check_turno returned send={send_flag}, plantilla={plantilla} for turno {id_turno}")
            return

        # validar teléfono
        if not carac_tel or not tel:
            print(f"[DEBUG] No hay teléfono válido para id_turno={id_turno} (carac={carac_tel}, tel={tel})")
            try:
                Mensaje.objects.create(
                    id_turno_id=id_turno,
                    id_plantilla_id=getattr(plantilla, "id"),
                    fecha_envio=datetime.now(),
                    id_estado_id=-3,
                )
            except Exception as ex:
                print(f"[ERROR] al crear Mensaje para turno {id_turno}: {ex}")
            return

        telefono = ("549" + str(carac_tel) + str(tel)).replace(" ", "")

        fecha_literal = str(fecha_turno).split(" ")[0]
        s_h = str(hora_turno).split(".")[0]
        if " " in s_h:
            hora_literal = s_h.split(" ", 1)[1]
        else:
            hora_literal = s_h

        datos_plantilla = {
            "nompac": nom_pac or "",
            "apepac": ape_pac or "",
            "fecha": fecha_literal,
            "horaturno": hora_literal,
            "nomprof": nom_prof or "",
            "apeprof": ape_prof or "",
            "especialidad": nombre_especialidad or "",
            "efector": nombre_efector or "",
            "nombre_servicio": nombre_servicio or "",
            "calle": calle or "",
            "altura": altura or "",
            "letra": letra or "",
            "coordx": coordx or "",
            "coordy": coordy or "",
            "tel_efe": tel_efe or "",
            "calle_nom": calle_nom or "",
        }

        mensaje = format_plantilla(plantilla.contenido, datos_plantilla)
        res = enviar_whatsapp(telefono, mensaje)
        response_data = getattr(res, "data", {}) or {}



        # mapear estados a ack
        status = getattr(res, "status_code", None)
        if status == 503:
            ack = -4
        elif status == 400:
            ack = -3
        elif status == 404:
            ack = -2
        elif status == 500:
            ack = -1
        else:
            ack = response_data.get("ack", None)

        try:
            Mensaje.objects.create(
                id_mensaje=response_data.get("id", None),
                id_turno_id=id_turno,
                numero=telefono,
                id_plantilla_id=getattr(plantilla, "id"),
                fecha_envio=datetime.now(),
                id_estado_id=ack,
            )
        except Exception as ex:
            print(f"[ERROR] al crear Mensaje para turno {id_turno}: {ex}")
            return

        if ack >= 0:
            try:
                Turno.objects.filter(id=id_turno).update(msj_recordatorio=1)
            except Exception as ex:
                print(f"[ERROR] al actualizar flags msj_* en Turno id={id_turno}: {ex}")

    except Exception as e:
        print(f"[ERROR general en send_reminder_task para id_turno={id_turno}]: {e}")

@shared_task
def verificar_turnos2():
    print(f"[{timezone.now()}] Ejecutando verificación de turnos...")
    tz = pytz.timezone(settings.TIME_ZONE)
    # Obtener/crear LastMod (mantener aware si USE_TZ)
    try:
        last_mod_obj = LastMod.objects.first()
        if not last_mod_obj:
            lm0 = datetime(1970, 1, 1, 0, 0, 0)
            if settings.USE_TZ:
                lm0 = timezone.make_aware(lm0, timezone.get_default_timezone())
            last_mod_obj = LastMod.objects.create(fecha=lm0)
        last_mod_raw = last_mod_obj.fecha
    except Exception as e:
        print(f"[ERROR] al obtener/crear LastMod: {e}")
        return

    try:
        conn = connections['informix']
        with conn.cursor() as cur:
            lm_param = last_mod_raw.strftime("%Y-%m-%d %H:%M:%S")
            print(f"[DEBUG] Usando last_mod para consulta Informix: {lm_param!r}")

            try:
                cur.execute("""
                    SELECT idturasighistorico, idestadoturno, fecha_hora_mdf
                    FROM turnosdtt_historico
                    WHERE fecha_hora_mdf > ?
                    ORDER BY fecha_hora_mdf
                """, [lm_param])
            except Exception as ex:
                print(f"[ERROR] al ejecutar consulta de notificaciones con param {lm_param!r}: {ex}")
                return

            mejor_raw = None

            for r in cur.fetchall():
                print(f"[DEBUG] notificacion raw: {r}")
                idturno, idestadoturno,  last_modf_val = r

                este_raw = str(last_modf_val).split(".")[0]
                if mejor_raw is None or este_raw > mejor_raw:
                    mejor_raw = este_raw

                # Mapeo de idestadoturno -> estado (restaurado al mapping esperado)
                if idestadoturno == 3:
                    estado = 1
                elif idestadoturno in (4, 5, 6):
                    estado = 4
                elif idestadoturno in (1, 2, 7):
                    estado = 2
                elif idestadoturno == 8:
                    estado = 3
                else:
                    continue

                # Si corresponde (0 o 3) traigo detalles completos
                detalles = None
                if estado in (1, 3):
                    try:
                        cur.execute(make_query2(1), [idturno])
                        detalles = cur.fetchone()
                    except Exception as ex:
                        print(f"[ERROR] al ejecutar make_query() para idturno={idturno}: {ex}")
                        continue

                    if not detalles:
                        print(f"[DEBUG] No hay detalles para idturno={idturno}")
                        continue

                    (
                        _id_from_row, id_efector, cod_ser_dtt, id_efe_ser_esp ,
                        tipo_doc, nro_doc, ape_pac, nom_pac, fecha_turno, hora_turno,
                        ape_prof, nom_prof, nombre_servicio, nombre_especialidad,
                        nombre_efector, calle, altura, letra, coordx, coordy,
                        tel_efe, calle_nom, carac_tel, tel
                    ) = detalles
                    # parsear
                    d_fecha = parse_date(fecha_turno)
                    d_hora = parse_time(hora_turno)

                    d_fecha = d_fecha.strftime("%d-%m-%Y")
                    d_hora = d_hora.strftime("%H:%M")

                    # formatear al formato pedido: '%d-%m-%Y' y '%H:%M'
                    fecha_literal = str(fecha_turno).split(" ")[0]

                    s_h = str(hora_turno).split(".")[0] 
                    if " " in s_h:
                        hora_literal = s_h.split(" ", 1)[1] 
                    else:
                        hora_literal = s_h

                    if estado == 1:
                        try:
                            Turno.objects.create(
                                id=idturno,
                                id_estado_id=estado,
                                msj_confirmado=0,
                                msj_reprogramado=0,
                                msj_cancelado=0,
                                msj_recordatorio=0,
                                id_efe_ser_esp_id=id_efe_ser_esp,
                                fecha=fecha_literal,
                                hora=hora_literal
                            )
                            print(f"[INFO] Creado Turno id={idturno} fecha={fecha_literal} hora={hora_literal}")
                        except Exception as ex:
                            print(f"[ERROR] al crear Turno id={idturno}: {ex}")
                            continue

                if estado in (2, 3, 4):
                    try:
                        filas_actualizadas = Turno.objects.filter(id=idturno).update(id_estado_id=estado)
                        if filas_actualizadas == 0:
                            print(f"[DEBUG] No existe Turno local con id={idturno} => se ignora notificación (estado={estado})")
                            continue

                        print(f"[INFO] Actualizado Turno id={idturno} a estado={estado} (filas_actualizadas={filas_actualizadas})")
                    except Exception as ex:
                        print(f"[ERROR] al actualizar Turno id={idturno}: {ex}")
                        continue

                    # Si estado == 2 (suspendido) traer persona + efector + enviar
                    if estado == 2:
                        try:
                            # obtener datos persona de forma segura
                            cur.execute(query_persona(), [idpaciente])
                            persona_row = cur.fetchone()
                            if persona_row:
                                ape_pac, nom_pac, carac_tel, tel = persona_row
                            else:
                                ape_pac = nom_pac = carac_tel = tel = None

                            # --- cambio mínimo: obtener id_efe_ser_esp desde Turno si no lo tenemos
                            id_efe_ser_esp = Turno.objects.filter(id=idturno).values_list("id_efe_ser_esp_id", flat=True).first()

                            # obtener EfeSerEsp para sacar efector/servicio/especialidad (asumimos que existe)
                            ese_obj = EfeSerEsp.objects.select_related(
                                "id_efector", "id_servicio", "id_especialidad"
                            ).get(pk=id_efe_ser_esp)

                            id_efector = ese_obj.id_efector_id
                            id_servicio = ese_obj.id_servicio_id
                            id_especialidad = ese_obj.id_especialidad_id

                            nombre_servicio = ese_obj.id_servicio.nombre if hasattr(ese_obj, "id_servicio") and ese_obj.id_servicio else None
                            nombre_especialidad = ese_obj.id_especialidad.nombre if hasattr(ese_obj, "id_especialidad") and ese_obj.id_especialidad else None

                            # datos del efector vía cursor Informix
                            nombre_efector = calle = altura = letra = coordx = coordy = tel_efe = calle_nom = None
                            if id_efector:
                                cur.execute(query_efector(), [id_efector])
                                ef_row = cur.fetchone()
                                if ef_row:
                                    (nombre_efector, calle, altura, letra,
                                    coordx, coordy, tel_efe, calle_nom) = ef_row

                            # obtener fecha/hora guardadas en Turno (siempre strings según create)
                            fecha_literal = Turno.objects.filter(id=idturno).values_list("fecha", flat=True).first()
                            hora_literal = Turno.objects.filter(id=idturno).values_list("hora", flat=True).first()

                            # intentar parsear sin hacer chequeos extra (cambio mínimo)
                            try:
                                d_fecha = parse_date(fecha_literal).strftime("%d-%m-%Y")
                            except Exception:
                                d_fecha = fecha_literal
                            try:
                                d_hora = parse_time(hora_literal).strftime("%H:%M")
                            except Exception:
                                d_hora = hora_literal

                            nom_prof = None
                            ape_prof = None
                        except Exception as ex:
                            print(f"[ERROR] al procesar estado 2 para idturno={idturno}: {ex}")
                            continue

                if estado == 4:
                    continue

                # Asegurar que id_efe_ser_esp esté definido antes de check_turno:
                if "id_efe_ser_esp" not in locals() or id_efe_ser_esp is None:
                    id_efe_ser_esp = Turno.objects.filter(id=idturno).values_list("id_efe_ser_esp_id", flat=True).first()

                telefono = None
                send, plantilla = check_turno(id_efe_ser_esp, estado)
                if send and plantilla:
                    if carac_tel and tel:
                        telefono = ("549" + str(carac_tel) + str(tel)).replace(" ", "")

                        datos_plantilla = {
                            "nompac": nom_pac or "",
                            "apepac": ape_pac or "",
                            "fecha": d_fecha,
                            "horaturno": d_hora,
                            "nomprof": nom_prof or "",
                            "apeprof": ape_prof or "",
                            "especialidad": nombre_especialidad or "",
                            "efector": nombre_efector or "",
                            "servicio": nombre_servicio or "",
                            "calle": calle or "",
                            "altura": altura or "",
                            "letra": letra or "",
                            "coordx": coordx or "",
                            "coordy": coordy or "",
                            "tel_efe": tel_efe or "",
                            "calle_nom": calle_nom or "",
                        }

                        mensaje = format_plantilla(plantilla.contenido, datos_plantilla)
                        res = enviar_whatsapp(telefono, mensaje)
                        response_data = getattr(res, "data", {}) or {}

                        if res.status_code == 503:
                            ack = -4
                        elif res.status_code == 400:
                            ack = -3
                        elif res.status_code == 404:
                            ack = -2
                        elif res.status_code == 500:
                            ack = -1
                        else:
                            ack = response_data.get("ack")

                        try:
                            Mensaje.objects.create(
                                id_mensaje=response_data.get("id", None),
                                id_turno_id=idturno,
                                numero=telefono,
                                id_plantilla=plantilla,
                                fecha_envio=datetime.now(),
                                id_estado_id=ack,
                            )
                        except Exception as ex:
                            print(f"[ERROR] al crear Mensaje para turno {idturno}: {ex}")
                            continue

                        if ack >= 0:  # actualizar flags en Turno
                            try:
                                if estado == 1:
                                    Turno.objects.filter(id=idturno).update(msj_confirmado=1)
                                elif estado == 2:
                                    Turno.objects.filter(id=idturno).update(msj_cancelado=1)
                                elif estado == 3:
                                    Turno.objects.filter(id=idturno).update(msj_reprogramado=1)
                            except Exception as ex:
                                print(f"[ERROR] al actualizar flags msj_* en Turno id={idturno}: {ex}")
                    else:
                        print(f"[DEBUG] No hay teléfono válido para idturno={idturno} (carac_tel={carac_tel}, tel={tel})")
                        try:
                            Mensaje.objects.create(
                                id_turno_id=idturno,
                                id_plantilla=plantilla,
                                numero=telefono,
                                fecha_envio=datetime.now(),
                                id_estado_id=-3,
                            )
                        except Exception as ex:
                            print(f"[ERROR] al crear Mensaje para turno {idturno}: {ex}")
                else:
                    print(f"[DEBUG] check_turno returned send={send}, plantilla={plantilla} for turno {idturno}")

            # Al final: actualizar LastMod con mejor_raw EXACTO (SQL directo en default_connection)
            try:
                if mejor_raw is None:
                    print("[DEBUG] No se encontró mejor_raw -> no se actualiza LastMod")
                else:
                    table_name = LastMod._meta.db_table
                    pk_col = LastMod._meta.pk.column
                    with default_connection.cursor() as cur2:
                        cur2.execute(
                            f"UPDATE {table_name} SET fecha = %s WHERE {pk_col} = %s",
                            [mejor_raw, last_mod_obj.pk]
                        )
                    print(f"[DEBUG] Actualizado LastMod.fecha EXACTO = {mejor_raw!r} (UPDATE directo)")
            except Exception as ex:
                print(f"[ERROR] al actualizar LastMod con SQL directo: {ex}")

    except Exception as e:
        print(f"[ERROR] Error en verificación de turnos: {e}")





