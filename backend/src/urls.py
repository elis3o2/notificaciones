from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from src.views import (
    PlantillaViewSet, EstadoMsjViewSet, EstadoTurnoViewSet,
    TurnoViewSet, MensajeViewSet, EfectorViewSet, EspecialidadViewSet,
    EfectorPlantillaViewSet, CustomTokenObtainPairView, ServicioViwSet,
    SendWSP, TurnosMergedAllAPIView, GetEstadoMSJ, HistoricoPaciente,
)

router = DefaultRouter()
router.register('plantilla', PlantillaViewSet, basename='plantilla')
router.register('estado_msj', EstadoMsjViewSet, basename='estado_msj')
router.register('estado_turno', EstadoTurnoViewSet, basename='estado_turno')
router.register('efectores', EfectorViewSet, basename='efector')
router.register('turnos', TurnoViewSet, basename='turno')
router.register('mensajes', MensajeViewSet, basename='mensaje')
router.register('especialidades', EspecialidadViewSet, basename='especialidad')
router.register('servicios', ServicioViwSet, basename='servicio')
router.register('efector_plantilla', EfectorPlantillaViewSet, basename='efector_plantilla')

# src/urls.py
urlpatterns = [
    path('', include(router.urls)),
    path('turnos-merged-all-list/', TurnosMergedAllAPIView.as_view(), name='turnos-merged-all'),
    path('send_wsp/', SendWSP.as_view(), name='send_mensaje'),
    path('get_last_ack/', GetEstadoMSJ.as_view(), name='get_last_ack'),
    path('get_historico/', HistoricoPaciente.as_view(), name='get_historico'),
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
