# backend/core/informix_jdbc_backend/operations.py
from django.db.backends.base.operations import BaseDatabaseOperations

class DatabaseOperations(BaseDatabaseOperations):
    """
    Implementación mínima para solo-lectura: quote_name es lo que Django necesita.
    """
    def quote_name(self, name):
        if not isinstance(name, str):
            return name
        if name.startswith('"') and name.endswith('"'):
            return name
        return f'"{name}"'
