from django.urls import path, include

urlpatterns = [
    path('apiturnos/', include('src.urls')),
]
