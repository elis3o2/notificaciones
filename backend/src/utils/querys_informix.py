
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