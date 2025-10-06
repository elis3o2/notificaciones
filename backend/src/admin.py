from django.contrib import admin
from src.models import EfeSerEspPlantilla

# app/admin.py
@admin.register(EfeSerEspPlantilla)
class EfeSerEspPlantillaAdmin(admin.ModelAdmin):
    def save_model(self, request, obj, form, change):
        obj._usuario = request.user
        super().save_model(request, obj, form, change)
