# backend/core/informix_jdbc_backend/base.py
"""
Backend mínimo "liviano" para Informix via JDBC usando jaydebeapi.
Evita circular imports y expone lo mínimo que Django espera.
"""
from decouple import config
import jpype
import threading
import jaydebeapi
import logging
logger = logging.getLogger(__name__)
# Colocar al comienzo del módulo (si no está ya)

# Lock para evitar llamadas concurrentes a startJVM en diferentes hilos
_JVM_START_LOCK = threading.Lock()
# Intentamos importar las clases base de Django; si hay un problema (circular import),
# definimos stand-ins ligeros para permitir importar el módulo.
try:
    from django.db.backends.base.base import BaseDatabaseWrapper
    from django.db.backends.base.features import BaseDatabaseFeatures
    from django.db.backends.base.operations import BaseDatabaseOperations as _BaseDBOperations
    from django.db.backends.base.client import BaseDatabaseClient
    from django.db.backends.base.validation import BaseDatabaseValidation
except Exception:
    class BaseDatabaseWrapper:  # type: ignore
        pass
    class BaseDatabaseFeatures:  # type: ignore
        pass
    class _BaseDBOperations:  # type: ignore
        pass
    class BaseDatabaseClient:  # type: ignore
        pass
    class BaseDatabaseValidation:  # type: ignore
        pass

# Importar jaydebeapi (debe estar instalado en el venv)
import jaydebeapi
import re

# Cursor wrapper que normaliza la sentencia antes de enviarla al driver JDBC
class CursorWrapper:
    def __init__(self, real_cursor):
        self._cur = real_cursor
        self._param_re = re.compile(r"%s")

    def _normalize_sql(self, operation, params):
        # 1) eliminar backticks (turnos_notificaciones`.`id -> turnos_notificaciones.id)
        operation = operation.replace("`", "")

        # 2) convertir LIMIT n -> FIRST n (only if hay un LIMIT)
        # buscamos "LIMIT <n>" al final o seguido por espacio
        m = re.search(r"\bLIMIT\s+(\d+)\b", operation, flags=re.IGNORECASE)
        if m:
            n = m.group(1)
            # eliminar la cláusula LIMIT
            operation = re.sub(r"\s+LIMIT\s+\d+\b", "", operation, flags=re.IGNORECASE)

            # insertar FIRST n luego de SELECT (o SELECT DISTINCT)
            if re.match(r"(?i)^\s*SELECT\s+DISTINCT", operation):
                operation = re.sub(r"(?i)^\s*SELECT\s+DISTINCT",
                                   f"SELECT DISTINCT FIRST {n}", operation, count=1)
            else:
                operation = re.sub(r"(?i)^\s*SELECT",
                                   f"SELECT FIRST {n}", operation, count=1)

        # 3) reemplazar placeholders %s -> ? si hay params
        if params:
            operation = self._param_re.sub("?", operation)

        return operation

    def execute(self, operation, params=None):
        if isinstance(operation, str):
            operation = self._normalize_sql(operation, params)

        if params is None:
            return self._cur.execute(operation)
        else:
            # jaydebeapi acepta secuencia/túpla de parámetros
            return self._cur.execute(operation, params)

    def executemany(self, operation, seq_of_params):
        if isinstance(operation, str):
            # si seq_of_params no está vacío usamos placeholder
            operation = self._normalize_sql(operation, bool(seq_of_params))
        return self._cur.executemany(operation, seq_of_params)

    # Passthroughs
    def fetchone(self):
        return self._cur.fetchone()
    def fetchall(self):
        return self._cur.fetchall()
    def fetchmany(self, size=None):
        if size is None:
            return self._cur.fetchmany()
        return self._cur.fetchmany(size)
    def close(self):
        return self._cur.close()
    def __getattr__(self, name):
        return getattr(self._cur, name)
    

# ----------------------------
# Database "módulo" mínimo con excepciones
# ----------------------------
class _DBExc(Exception):
    """Base para excepciones DB mínimas (stand-in)."""
    pass

class _DatabaseModule:
    Error = _DBExc
    DatabaseError = _DBExc
    DataError = _DBExc
    IntegrityError = _DBExc
    OperationalError = _DBExc
    ProgrammingError = _DBExc
    InterfaceError = _DBExc
    InternalError = _DBExc
    NotSupportedError = _DBExc
    Warning = _DBExc

# Exponer al módulo por si Django lo busca a nivel de wrapper.Database
Database = _DatabaseModule

# ----------------------------
# Stand-in helper classes mínimas
# ----------------------------
class DatabaseCreation:
    def __init__(self, wrapper):
        self.connection = wrapper
    def create_test_db(self, *args, **kwargs):
        raise NotImplementedError("create_test_db is not supported for Informix JDBC backend")

class DatabaseIntrospection:
    def __init__(self, wrapper):
        self.connection = wrapper
    def get_table_list(self, cursor):
        try:
            cursor.execute("SELECT tabname FROM systables")
            return [row[0] for row in cursor.fetchall()]
        except Exception:
            return []

class DatabaseSchemaEditor:
    def __init__(self, *args, **kwargs):
        raise NotImplementedError("Schema editing not supported for Informix JDBC backend")

# ----------------------------
# Importar DatabaseOperations desde operations.py (evitar definirla aquí)
# ----------------------------
try:
    from .operations import DatabaseOperations
except Exception:
    # Si por alguna razón no se puede importar, definimos un fallback muy simple:
    class DatabaseOperations(_BaseDBOperations):
        def quote_name(self, name):
            if isinstance(name, str) and name.startswith('"') and name.endswith('"'):
                return name
            return f'"{name}"'

# ----------------------------
# Backend wrapper
# ----------------------------
class DatabaseFeatures(BaseDatabaseFeatures):
    pass

class DatabaseClient(BaseDatabaseClient):
    pass

class DatabaseValidation(BaseDatabaseValidation):
    pass


class DatabaseWrapper(BaseDatabaseWrapper):
    """
    Wrapper mínimo que Django puede instanciar. Usa jaydebeapi para crear
    la conexión JDBC a Informix. Implementa create_cursor, is_usable, close y autocommit.
    """

    vendor = 'informix'
    display_name = 'Informix (JDBC)'

    # Clases que Django intentará instanciar
    features_class = DatabaseFeatures
    ops_class = DatabaseOperations
    client_class = DatabaseClient
    validation_class = DatabaseValidation

    # Clases mínimas para evitar llamadas a None
    creation_class = DatabaseCreation
    introspection_class = DatabaseIntrospection
    schema_editor_class = DatabaseSchemaEditor

    # Exponer un "Database" con excepciones mínimas
    Database = _DatabaseModule

    def __init__(self, settings_dict, alias):
        super().__init__(settings_dict, alias)
        # aseguramos la instancia ops correcta
        self.ops = self.ops_class(self)

    def get_connection_params(self):
        return self.settings_dict



    def get_new_connection(self, conn_params):
        """
        Abre una conexión JDBC a Informix, asegurando:
        - que la JVM se arranque sólo una vez por proceso (uso de lock),
        - que el hilo actual quede adjuntado a la JVM si ésta ya estaba iniciada.
        """
        informix_jar = config('JDBC_ROUTE')
        bson_jar = config('BNSON_ROUTE')
        classpath = f"{informix_jar}:{bson_jar}"

        jdbc_url = (
            f"jdbc:informix-sqli://{conn_params.get('HOST')}:{conn_params.get('PORT')}/"
            f"{conn_params.get('NAME')}:INFORMIXSERVER={conn_params.get('SERVER')}"
        )

        user = conn_params.get("USER")
        password = conn_params.get("PASSWORD")

        try:
            # Intentar arrancar la JVM sólo si no está iniciada (protegemos con lock)
            if not jpype.isJVMStarted():
                with _JVM_START_LOCK:
                    # doble-check dentro del lock para evitar race condition
                    if not jpype.isJVMStarted():
                        jvm_path = jpype.getDefaultJVMPath()
                        jvm_arg = "-Djava.class.path=" + classpath
                        logger.info("Arrancando JVM (jpype). jvm_path=%s classpath=%s", jvm_path, classpath)
                        try:
                            # convertStrings=False evita conversiones automáticas problemáticas
                            jpype.startJVM(jvm_path, jvm_arg, convertStrings=False)
                        except OSError as e:
                            # Si otro hilo arrancó la JVM entre la comprobación y el start,
                            # manejamos el caso en lugar de fallar.
                            if "JVM is already started" in str(e):
                                logger.warning("Intento de startJVM detectó que la JVM ya fue iniciada por otro hilo.")
                            else:
                                logger.exception("OSError al iniciar la JVM: %s", e)
                                raise

            else:
                logger.debug("JVM ya iniciada previamente. No se intenta startJVM.")

            # Asegurarnos de adjuntar el hilo actual a la JVM (necesario en entornos multihilo)
            try:
                # Algunas versiones de jpype disponen de isThreadAttachedToJVM()
                if hasattr(jpype, "isThreadAttachedToJVM"):
                    attached = jpype.isThreadAttachedToJVM()
                else:
                    # Si no existe esa función, intentamos attach y capturamos errores
                    attached = True

                if not attached:
                    jpype.attachThreadToJVM()
                    logger.debug("Hilo actual adjuntado a la JVM.")
            except Exception as e:
                # No queremos que un fallo en attach impida abrir la conexión; logueamos.
                logger.exception("No se pudo adjuntar el hilo a la JVM: %s", e)

            # Finalmente abrir la conexión JDBC con jaydebeapi
            conn = jaydebeapi.connect(
                "com.informix.jdbc.IfxDriver",
                jdbc_url,
                [user, password],
            )
            return conn

        except Exception as e:
            # Log completo para depuración
            logger.exception("Error abriendo conexión Informix via JDBC: %s", e)
            raise


    def _set_autocommit(self, autocommit):
        if not getattr(self, "connection", None):
            return
        try:
            # jaydebeapi expone .jconn (objeto java.sql.Connection) en general
            self.connection.jconn.setAutoCommit(autocommit)
        except Exception as e:
            logger.exception("Error configurando autocommit: %s", e)
            raise

    def init_connection_state(self):
        pass
    
    def create_cursor(self, name=None):
        if not getattr(self, "connection", None):
            self.connect()
        try:
            real_cur = self.connection.cursor()
            return CursorWrapper(real_cur)
        except Exception:
            logger.exception("Error creando cursor Informix")
            raise

    def is_usable(self):
        try:
            cur = self.create_cursor()
            cur.execute("SELECT 1 FROM systables WHERE tabid=1")
            try:
                cur.fetchall()
            except Exception:
                pass
            try:
                cur.close()
            except Exception:
                pass
            return True
        except Exception:
            return False

    def close(self):
        conn = getattr(self, "connection", None)
        if conn:
            try:
                conn.close()
            except Exception:
                logger.exception("Error cerrando conexión Informix")
        self.connection = None
