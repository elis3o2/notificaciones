# urls.py
from django.urls import path, include, re_path
from django.views.generic import TemplateView # O tu vista 'frontend'
from src.views import CustomTokenObtainPairView, frontend

urlpatterns = [
    path("turnos/api/token/", CustomTokenObtainPairView.as_view()),
    path("turnos/api/", include("src.urls")),

    # Catch-all: Cualquier cosa que empiece con /turnos/ y no haya 
    # entrado en las rutas anteriores, se lo enviamos a React.
    re_path(r"^turnos/.*$", frontend), 
]