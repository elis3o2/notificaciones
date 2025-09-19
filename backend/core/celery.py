import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')

# Lee configuración de Django, prefijada con CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto descubre tasks.py en tus apps
app.autodiscover_tasks()
