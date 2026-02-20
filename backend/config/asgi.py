"""
ASGI config for Office Suite 360 project.
ProtocolTypeRouter: http (Daphne) + websocket (чат, уведомления).
"""
import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

django_asgi_app = get_asgi_application()

# WebSocket: JWT из query (?token=...) + маршруты из config.routing
from config.routing import websocket_urlpatterns
from apps.notifications.middleware import JWTAuthMiddleware

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
