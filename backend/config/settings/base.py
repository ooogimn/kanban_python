"""
Django settings for Office Suite 360 project.
"""
import json
import os
import sys
import logging
from pathlib import Path
import environ

# Fix encoding issues on Windows
if sys.platform == 'win32':
    # Set UTF-8 encoding for stdout/stderr
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
    # Set environment variable for encoding
    os.environ.setdefault('PYTHONIOENCODING', 'utf-8')

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Initialize environment variables
env = environ.Env(
    DEBUG=(bool, False)
)

# Read .env: сначала корень проекта (родитель backend), затем backend
_env_candidates = [
    BASE_DIR.parent / '.env',
    BASE_DIR / '.env',
]
for env_file in _env_candidates:
    if env_file.exists():
        environ.Env.read_env(str(env_file), encoding='utf-8')
        break

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY', default='django-insecure-change-me-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG', default=False)

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

# Application definition (daphne первым — ASGI-сервер для WebSocket)
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sitemaps',
    
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'djoser',
    'corsheaders',
    'django_filters',
    'channels',
    'drf_spectacular',
    
    # Local apps
    'apps.crm',
    'apps.core',
    'apps.finance',
    'apps.billing',
    'apps.hr',
    'apps.auth',
    'apps.todo',
    'apps.kanban',
    'apps.calendar',
    'apps.schedule',
    'apps.gantt',
    'apps.analytics',
    'apps.integrations',
    'apps.notifications',
    'apps.chat',
    'apps.bot',
    'apps.timetracking',
    'apps.documents',
    'apps.mindmaps',
    'apps.goals',
    'apps.inbox',
    'apps.automation',
    'apps.templates',
    'apps.habits',
    'apps.ai',
    'apps.saas',
    'apps.blog',
    'apps.marketing',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.notifications.middleware_audit.AuditRequestMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
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

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'  # Daphne использует этот entry point

# Database
# Ensure all database connection strings are properly decoded
def safe_decode(value):
    """Safely decode string value, handling encoding issues."""
    if value is None:
        return None
    if isinstance(value, bytes):
        try:
            return value.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return value.decode('latin-1')
            except UnicodeDecodeError:
                return value.decode('cp1251', errors='ignore')
    # Convert to string and ensure it's valid UTF-8
    str_value = str(value)
    try:
        str_value.encode('utf-8')
        return str_value
    except UnicodeEncodeError:
        return str_value.encode('utf-8', errors='ignore').decode('utf-8')

# Get database parameters and ensure they're properly encoded
db_name = safe_decode(env('DB_NAME', default='office_suite'))
db_user = safe_decode(env('DB_USER', default='postgres'))
db_password = safe_decode(env('DB_PASSWORD', default='postgres'))
db_host = safe_decode(env('DB_HOST', default='localhost'))
db_port = safe_decode(env('DB_PORT', default='5432'))

# Aggressively clear ALL PostgreSQL environment variables to avoid encoding issues
# psycopg2 reads these variables and they may contain wrong encoding on Windows
if sys.platform == 'win32':
    # Clear ALL PG* environment variables that psycopg2 might read
    pg_vars_to_clear = [
        'PGPASSWORD', 'PGDATABASE', 'PGUSER', 'PGHOST', 'PGPORT',
        'PGPASSFILE', 'PGSERVICE', 'PGSERVICEFILE', 'PGREALM',
        'PGOPTIONS', 'PGAPPNAME', 'PGSSLMODE', 'PGSSLROOTCERT',
        'PGSSLCERT', 'PGSSLKEY', 'PGSSLCRL', 'PGSSLCOMPRESSION',
        'PGREQUIRESSL', 'PGKRBSRVNAME', 'PGGSSLIB', 'PGCONNECT_TIMEOUT'
    ]
    for var in pg_vars_to_clear:
        if var in os.environ:
            del os.environ[var]
    
    # Also clear any variables that might contain paths with Cyrillic
    # These are stored but not used directly
    for key in list(os.environ.keys()):
        if key.startswith('PG') and key not in ['PGPASSWORD']:
            try:
                # Try to encode/decode to check if it has encoding issues
                val = os.environ[key]
                if isinstance(val, str):
                    val.encode('utf-8')
            except (UnicodeEncodeError, UnicodeDecodeError):
                # If encoding fails, remove the variable
                del os.environ[key]

DATABASES = {
    'default': {
        'ENGINE': 'config.db_backend',  # Используем кастомный backend для обхода проблем с кодировкой
        'NAME': db_name,
        'USER': db_user,
        'PASSWORD': db_password,
        'HOST': db_host,
        'PORT': db_port,
        'OPTIONS': {
            'client_encoding': 'UTF8',
            'connect_timeout': 10,
        },
        'CONN_MAX_AGE': 0,  # Disable persistent connections to avoid encoding issues
    }
}

# Указываем Django использовать psycopg3 (если установлен)
# Django автоматически обнаружит psycopg3 и использует его вместо psycopg2
try:
    import psycopg
    # psycopg3 установлен, Django будет использовать его автоматически
except ImportError:
    # psycopg3 не установлен, будет использоваться psycopg2
    pass

# Redis configuration
REDIS_URL = env('REDIS_URL', default='redis://localhost:6379/0')

# Cache configuration
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
    }
}

# Channel layers (для WebSocket, чата, живых обновлений)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [env('REDIS_URL', default='redis://127.0.0.1:6379/0')],
        },
    },
}

# Celery Configuration
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# Периодические экспорты в Google Sheets (Celery Beat, каждый час).
# JSON в env GOOGLE_SHEETS_SCHEDULED_EXPORTS: [{"project_id": 1, "sheet_id": "1abc..."}]
_scheduled = os.environ.get('GOOGLE_SHEETS_SCHEDULED_EXPORTS', '[]')
try:
    GOOGLE_SHEETS_SCHEDULED_EXPORTS = json.loads(_scheduled) if isinstance(_scheduled, str) else _scheduled
except (json.JSONDecodeError, TypeError):
    GOOGLE_SHEETS_SCHEDULED_EXPORTS = []

CELERY_BEAT_SCHEDULE = {
    'google-sheets-scheduled-exports': {
        'task': 'apps.integrations.tasks.run_scheduled_google_sheets_exports',
        'schedule': 3600.0,
    },
    'billing-refresh-usage-summaries': {
        'task': 'apps.billing.tasks.refresh_usage_summaries',
        'schedule': 300.0,
    },
    'billing-enforce-subscription-access-states': {
        'task': 'apps.billing.tasks.enforce_subscription_access_states',
        'schedule': 900.0,
    },
    'billing-process-dunning-notifications': {
        'task': 'apps.billing.tasks.process_dunning_notifications',
        'schedule': 1800.0,
    },
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'ru'
TIME_ZONE = 'Europe/Moscow'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model (CustomUser = User alias in core.models)
AUTH_USER_MODEL = 'core.User'

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'apps.billing.exception_handler.billing_exception_handler',
}

# CORS settings
# Tauri v2 origins (CRITICAL): без них desktop-приложение получит Network Error
CORS_ALLOWED_ORIGINS = env.list(
    'CORS_ALLOWED_ORIGINS',
    default=[
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'tauri://localhost',
        'https://tauri.localhost',
        'http://tauri.localhost',
        'https://asset.localhost',
        'http://asset.localhost',
    ]
)
CORS_ALLOW_CREDENTIALS = True

# Редирект GET / на фронт (для dev — http://localhost:3000; в прод — ваш домен фронта)
FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:3000')
BACKEND_PUBLIC_URL = env('BACKEND_PUBLIC_URL', default='http://localhost:8000')

# Djoser (управление пользователями) — используем JWT, свои эндпоинты в apps.auth
DJOSER = {
    'USER_ID_FIELD': 'id',
    'LOGIN_FIELD': 'username',
    'SERIALIZERS': {},
}

# JWT Settings
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}

# API Documentation
SPECTACULAR_SETTINGS = {
    'TITLE': 'Office Suite 360 API',
    'DESCRIPTION': 'API для офисной системы управления проектами',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# Telegram Bot (Token и username от @BotFather)
TELEGRAM_BOT_TOKEN = env('TELEGRAM_BOT_TOKEN', default='')
TELEGRAM_BOT_USERNAME = env('TELEGRAM_BOT_USERNAME', default='')  # без @, для Deep Link

# Social Auth
SOCIAL_AUTH_STATE_TTL_SEC = env.int('SOCIAL_AUTH_STATE_TTL_SEC', default=600)
SOCIAL_AUTH_ALLOWED_FRONTEND_PATHS = env.list(
    'SOCIAL_AUTH_ALLOWED_FRONTEND_PATHS',
    default=['/login', '/register'],
)

SOCIAL_AUTH_GOOGLE_ENABLED = env.bool('SOCIAL_AUTH_GOOGLE_ENABLED', default=False)
SOCIAL_AUTH_GOOGLE_CLIENT_ID = env('SOCIAL_AUTH_GOOGLE_CLIENT_ID', default='')
SOCIAL_AUTH_GOOGLE_CLIENT_SECRET = env('SOCIAL_AUTH_GOOGLE_CLIENT_SECRET', default='')

SOCIAL_AUTH_YANDEX_ENABLED = env.bool('SOCIAL_AUTH_YANDEX_ENABLED', default=False)
SOCIAL_AUTH_YANDEX_CLIENT_ID = env('SOCIAL_AUTH_YANDEX_CLIENT_ID', default='')
SOCIAL_AUTH_YANDEX_CLIENT_SECRET = env('SOCIAL_AUTH_YANDEX_CLIENT_SECRET', default='')

SOCIAL_AUTH_VK_ENABLED = env.bool('SOCIAL_AUTH_VK_ENABLED', default=False)
SOCIAL_AUTH_VK_CLIENT_ID = env('SOCIAL_AUTH_VK_CLIENT_ID', default='')
SOCIAL_AUTH_VK_CLIENT_SECRET = env('SOCIAL_AUTH_VK_CLIENT_SECRET', default='')

SOCIAL_AUTH_MAIL_ENABLED = env.bool('SOCIAL_AUTH_MAIL_ENABLED', default=False)
SOCIAL_AUTH_MAIL_CLIENT_ID = env('SOCIAL_AUTH_MAIL_CLIENT_ID', default='')
SOCIAL_AUTH_MAIL_CLIENT_SECRET = env('SOCIAL_AUTH_MAIL_CLIENT_SECRET', default='')

SOCIAL_AUTH_PROVIDERS = {
    'google': {
        'enabled': SOCIAL_AUTH_GOOGLE_ENABLED,
        'client_id': SOCIAL_AUTH_GOOGLE_CLIENT_ID,
        'client_secret': SOCIAL_AUTH_GOOGLE_CLIENT_SECRET,
        'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_url': 'https://oauth2.googleapis.com/token',
        'scopes': ['openid', 'email', 'profile'],
        'use_nonce': True,
    },
    'yandex': {
        'enabled': SOCIAL_AUTH_YANDEX_ENABLED,
        'client_id': SOCIAL_AUTH_YANDEX_CLIENT_ID,
        'client_secret': SOCIAL_AUTH_YANDEX_CLIENT_SECRET,
        'authorize_url': 'https://oauth.yandex.ru/authorize',
        'token_url': 'https://oauth.yandex.ru/token',
        'scopes': ['login:email', 'login:info'],
        'use_nonce': False,
    },
    'vk': {
        'enabled': SOCIAL_AUTH_VK_ENABLED,
        'client_id': SOCIAL_AUTH_VK_CLIENT_ID,
        'client_secret': SOCIAL_AUTH_VK_CLIENT_SECRET,
        'authorize_url': 'https://oauth.vk.com/authorize',
        'token_url': 'https://oauth.vk.com/access_token',
        'scopes': ['email'],
        'use_nonce': False,
    },
    'mail': {
        'enabled': SOCIAL_AUTH_MAIL_ENABLED,
        'client_id': SOCIAL_AUTH_MAIL_CLIENT_ID,
        'client_secret': SOCIAL_AUTH_MAIL_CLIENT_SECRET,
        'authorize_url': 'https://oauth.mail.ru/login',
        'token_url': 'https://oauth.mail.ru/token',
        'scopes': ['userinfo'],
        'use_nonce': False,
    },
    'telegram': {
        'enabled': bool(TELEGRAM_BOT_TOKEN),
        'client_id': TELEGRAM_BOT_USERNAME,
        'client_secret': TELEGRAM_BOT_TOKEN,
    },
}

# Payments (R2)
YOOKASSA_SHOP_ID = env('YOOKASSA_SHOP_ID', default='')
YOOKASSA_SECRET_KEY = env('YOOKASSA_SECRET_KEY', default='')
YOOKASSA_RETURN_URL = env('YOOKASSA_RETURN_URL', default=f"{FRONTEND_URL.rstrip('/')}/account/payments")
YANDEX_PAY_MERCHANT_ID = env('YANDEX_PAY_MERCHANT_ID', default='')
YANDEX_PAY_API_KEY = env('YANDEX_PAY_API_KEY', default='')
YANDEX_PAY_TEST_MODE = env.bool('YANDEX_PAY_TEST_MODE', default=True)
YANDEX_PAY_API_URL = env(
    'YANDEX_PAY_API_URL',
    default='https://sandbox.pay.yandex.ru' if YANDEX_PAY_TEST_MODE else 'https://pay.yandex.ru',
)
BILLING_GRACE_PERIOD_HOURS = env.int('BILLING_GRACE_PERIOD_HOURS', default=72)
_dunning_schedule_raw = env('BILLING_DUNNING_SCHEDULE_HOURS', default='1,24,48')
try:
    BILLING_DUNNING_SCHEDULE_HOURS = [
        int(x.strip())
        for x in str(_dunning_schedule_raw).split(',')
        if str(x).strip()
    ] or [1, 24, 48]
except Exception:
    BILLING_DUNNING_SCHEDULE_HOURS = [1, 24, 48]

# Google Sheets (путь к JSON ключу сервисного аккаунта)
GOOGLE_APPLICATION_CREDENTIALS = env('GOOGLE_APPLICATION_CREDENTIALS', default='')

# SEO indexing (R6-SEO-4)
SEO_SITEMAP_PING_TEMPLATES = env.list(
    'SEO_SITEMAP_PING_TEMPLATES',
    default=[
        'https://www.google.com/ping?sitemap={sitemap}',
        'https://webmaster.yandex.ru/ping?sitemap={sitemap}',
    ],
)
INDEXNOW_ENABLED = env.bool('INDEXNOW_ENABLED', default=False)
INDEXNOW_KEY = env('INDEXNOW_KEY', default='')
INDEXNOW_HOST = env('INDEXNOW_HOST', default='')

# Monitoring (R3-S3)
SENTRY_DSN = env('SENTRY_DSN', default='')
SENTRY_ENVIRONMENT = env('SENTRY_ENVIRONMENT', default='development' if DEBUG else 'production')
SENTRY_TRACES_SAMPLE_RATE = env.float('SENTRY_TRACES_SAMPLE_RATE', default=0.05)
SENTRY_PROFILES_SAMPLE_RATE = env.float('SENTRY_PROFILES_SAMPLE_RATE', default=0.0)
SENTRY_SEND_PII = env.bool('SENTRY_SEND_PII', default=False)

if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_logging = LoggingIntegration(
            level=logging.INFO,
            event_level=logging.ERROR,
        )
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration(), CeleryIntegration(), sentry_logging],
            traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
            profiles_sample_rate=SENTRY_PROFILES_SAMPLE_RATE,
            send_default_pii=SENTRY_SEND_PII,
            environment=SENTRY_ENVIRONMENT,
        )
    except Exception:
        # Мониторинг не должен ломать запуск приложения.
        pass
# Admin notification
ADMIN_TELEGRAM_ID = env('ADMIN_TELEGRAM_ID', default='')

# Social Autoposting (R3-S3)
VK_API_ACCESS_TOKEN = env('VK_API_ACCESS_TOKEN', default='')
VK_GROUP_ID = env('VK_GROUP_ID', default='')
TELEGRAM_CHANNEL_ID = env('TELEGRAM_CHANNEL_ID', default='')
