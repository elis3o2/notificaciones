from pathlib import Path
from datetime import timedelta
from decouple import config, Csv
from celery.schedules import crontab

import pymysql
pymysql.install_as_MySQLdb()

# --------------------------------------------------
# BASE
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("DJANGO_SECRET_KEY")
DEBUG = False

ALLOWED_HOSTS = ["*"]

# --------------------------------------------------
# TIMEZONE / I18N
# --------------------------------------------------

USE_TZ = False
TIME_ZONE = "America/Argentina/Buenos_Aires"
CELERY_TIMEZONE = "America/Argentina/Buenos_Aires"

LANGUAGE_CODE = "en-us"
USE_I18N = True

# --------------------------------------------------
# STATIC (VITE + WHITENOISE)
# --------------------------------------------------

STATIC_URL = "/turnos/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STATICFILES_DIRS = [
    BASE_DIR.parent / "frontend" / "dist",
]

STATICFILES_STORAGE = (
    "whitenoise.storage.CompressedManifestStaticFilesStorage"
)

# --------------------------------------------------
# TEMPLATES (SPA)
# --------------------------------------------------

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "templates",
            BASE_DIR.parent / "frontend" / "dist", # <--- Añade esto
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --------------------------------------------------
# APPLICATIONS
# --------------------------------------------------

INSTALLED_APPS = [
    "src",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_vite",
]

# --------------------------------------------------
# MIDDLEWARE (ORDEN CORRECTO)
# --------------------------------------------------

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # 🔥 obligatorio
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# --------------------------------------------------
# URLS / WSGI
# --------------------------------------------------

ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"

# --------------------------------------------------
# DATABASES
# --------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST"),
        "PORT": config("DB_PORT"),
    },
    "informix": {
        "ENGINE": "core.informix_jdbc_backend",
        "NAME": config("DB_NAME_INFORMIX"),
        "USER": config("DB_USER_INFORMIX"),
        "PASSWORD": config("DB_PASSWORD_INFORMIX"),
        "HOST": config("DB_HOST_INFORMIX"),
        "PORT": config("DB_PORT_INFORMIX"),
        "SERVER": config("DB_SERVER_INFORMIX"),
    },
}

# --------------------------------------------------
# AUTH
# --------------------------------------------------

AUTH_USER_MODEL = "src.CustomUser"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --------------------------------------------------
# DJANGO-VITE (PRODUCCIÓN)
# --------------------------------------------------

DJANGO_VITE = {
    "default": {
        "dev_mode": False,
        "static_url_prefix": "turnos", # Debe ser el mismo 'base' de Vite
        "manifest_path": BASE_DIR.parent / "frontend" / "dist" / "manifest.json",
    }
}

# --------------------------------------------------
# REST / JWT
# --------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=12),
}

# --------------------------------------------------
# CORS / CSRF
# --------------------------------------------------

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = False

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:8000",
]

# --------------------------------------------------
# CELERY / REDIS
# --------------------------------------------------

CELERY_BROKER_URL = "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = "redis://localhost:6379/0"

CELERY_BEAT_SCHEDULE = {
    "verificar-turnos-cada-1min": {
        "task": "src.tasks.verificar_turnos",
        "schedule": 60.0,
    },
    "recordatorios-diarios": {
        "task": "src.tasks.programar_recordatorios",
        "schedule": crontab(hour=6),
    },
}

# --------------------------------------------------
# MISC
# --------------------------------------------------

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
