import os
from pathlib import Path

# ─── BASE DIR ───────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── SECURITY ───────────────────────────────────────────────────────
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-REPLACE_ME')
DEBUG = True
ALLOWED_HOSTS = ['*']  # In production, restrict to your domain(s)

# ─── APPLICATIONS ───────────────────────────────────────────────────
INSTALLED_APPS = [
    # Django built-ins
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',

    # CORS support (must come before GraphQL apps so middleware order is correct)
    'corsheaders',

    # GraphQL + file-upload support
    'graphene_django',
    'graphql_jwt',
    'graphene_file_upload',

    # Your apps
    'accounts',
    'files',
    'graph',
    'chat',
]

# ─── MIDDLEWARE ──────────────────────────────────────────────────────
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',                # ← must be first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ─── CORS CONFIGURATION ─────────────────────────────────────────────
_cors_env = os.environ.get("CORS_ALLOWED_ORIGINS", "")
CORS_ALLOWED_ORIGINS = [o for o in _cors_env.split(",") if o] or [
    # When you run Vite locally with `npm run dev`:
    "http://localhost:5173",
    "http://127.0.0.1:5173",

    # When you run the Vite container inside Docker Compose, service name is "frontend":
    "http://frontend:5173",
]
CORS_ALLOW_CREDENTIALS = True  # Allow credentialed requests (cookies/JWT)

# ─── URLCONF & TEMPLATES ────────────────────────────────────────────
ROOT_URLCONF = 'vault.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  # serve React index.html
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ─── WSGI & ASGI ────────────────────────────────────────────────────
WSGI_APPLICATION = 'vault.wsgi.application'
ASGI_APPLICATION = 'vault.asgi.application'

# ─── DATABASE ───────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.mysql',
        'NAME':     os.environ.get('MYSQL_DATABASE', 'vault_db'),
        'USER':     os.environ.get('MYSQL_USER',     'vault_user'),
        'PASSWORD': os.environ.get('MYSQL_PASSWORD', 's3cr3tpass'),
        'HOST':     os.environ.get('MYSQL_HOST',     'db'),
        'PORT':     os.environ.get('MYSQL_PORT',     '3306'),
    }
}

# ─── PASSWORD VALIDATION ────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── INTERNATIONALIZATION ───────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'UTC'
USE_I18N      = True
USE_TZ        = True

# ─── STATIC FILES (CSS / JS / IMAGES) ───────────────────────────────
STATIC_URL  = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'staticfiles']
STATIC_ROOT = BASE_DIR / 'static_root'

# ─── MEDIA (USER UPLOADS) ───────────────────────────────────────────
MEDIA_URL  = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ─── AUTH BACKENDS ──────────────────────────────────────────────────
AUTHENTICATION_BACKENDS = [
    'graphql_jwt.backends.JSONWebTokenBackend',  # for tokenAuth → request.user
    'django.contrib.auth.backends.ModelBackend', # for django admin / login
]

# ─── GRAPHENE + JWT CONFIG ─────────────────────────────────────────
GRAPHENE = {
    'SCHEMA': 'vault.schema.schema',
    'MIDDLEWARE': [
        'graphql_jwt.middleware.JSONWebTokenMiddleware',
    ],
}

# Channels layer configuration for WebSocket support
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# ─── DEFAULT PK FIELD TYPE ─────────────────────────────────────────
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
