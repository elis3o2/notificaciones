
def query_detalles_turno(size: int) -> str: 

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


def query_persona() -> str:
    return """
    SELECT 
        TRIM(per.apellido) AS apePac,
        TRIM(per.nombre_per) AS nomPac,
        TRIM(per.carac_telef) AS caracTelPacV_personas,
        CAST(per.nro_telef AS VARCHAR(13)) AS telPacV_personas
    FROM v_personas per
    WHERE per.id_persona = ?
    """

def query_efector() -> str:
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


def query_turnos_historico() -> str:
    return """
    SELECT idturno, idpaciente, idestadoturno, fecha_hora_mdf
    FROM turnoshistorico
    WHERE fecha_hora_mdf > ?
    ORDER BY fecha_hora_mdf
    """


def query_turno_historico_paciente() -> str:
    return """
        (SELECT 
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
        FROM turnoshistorico th
        JOIN turnos t ON th.idturno = t.idturno
        JOIN turnosestado es on es.idestadoturno = th.idestadoturno
        JOIN personalefector pe ON pe.idpersonalefector = t.idpersonalefector
        JOIN personal p ON p.idpersonal = pe.idpersonal
        JOIN efectores efe ON efe.idefector = pe.idefector
        JOIN efectorservesp ese ON ese.idefecservesp = t.idefecservesp
        JOIN especialidadesserv se ON se.idespecialidadserv = ese.idespecialidadserv
        JOIN servicios s ON s.idservicio = se.idservicio
        JOIN especialidades esp ON esp.idespecialidad = se.idespecialidad
        JOIN v_personas per ON per.id_persona = th.idpaciente
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
        FROM turnoselimresp te
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



def query_turnos(n: int) -> str:
    if n == 1:
        where_clause = "WHERE t.idturno = ?"
    else:
        placeholders = ",".join(["?"] * n)
        where_clause = f"WHERE t.idturno IN ({placeholders})"
    return f"""
        SELECT t.idturno, t.idpaciente AS paciente_id, TRIM(per.nombre_per) AS paciente_nombre, TRIM(per.apellido) AS paciente_apellido,
        per.nro_doc, TRIM(p.nombre) AS profesional_nombre, TRIM(p.apellido) AS profesional_apellido
        FROM turnos t
        JOIN personalefector pe ON pe.idpersonalefector = t.idpersonalefector
        JOIN personal p ON p.idpersonal = pe.idpersonal
        JOIN v_personas per ON per.id_persona = t.idpaciente           
        {where_clause}
    """ 


def query_eliminado(n: int) -> str:
    if n == 1:
        where_clause = "WHERE te.idturno = ?"
    else:
        placeholders = ",".join(["?"] * n)
        where_clause = f"WHERE te.idturno IN ({placeholders})"
    return f"""   
        SELECT te.idturno,te.idpaciente AS paciente_id, TRIM(per.nombre_per) AS paciente_nombre, TRIM(per.apellido) AS paciente_apellido,
        per.nro_doc, TRIM(p.nombre) AS nombre_profesional, TRIM(p.apellido) AS apellido_profesional
        FROM turnoselimresp te
        JOIN personalefector pe ON pe.idpersonalefector = te.idpersonalefector
        JOIN personal p ON p.idpersonal = pe.idpersonal
        JOIN v_personas per ON per.id_persona = te.idpaciente           
        {where_clause}                
    """



def query_paciente(id: bool) -> str:
    if id:
        where = "WHERE per.id_persona = ?"
    else:
        where = "WHERE per.nro_doc = ?"

    return f"""
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


def query_profesional_from_id () -> str:
    return """
    SELECT DISTINCT
        p.idpersonal AS id,
        TRIM(p.apellido) AS apellido,
        TRIM(p.nombre)   AS nombre
    FROM personal p
    WHERE p.idpersonal = ?
    """

def query_profesional_from_nombre (id_efe: str, nombre: str | None, apellido: str | None) -> str:
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
    if nombre and nombre.strip():
        sql += " AND p.nombre LIKE ?"
    if apellido and apellido.strip():
        sql += " AND p.apellido LIKE ?"

    sql += " ORDER BY apellido, nombre"
    return sql