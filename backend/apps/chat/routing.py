"""
WebSocket routing для чата.
"""
from django.urls import path
from .consumers import ChatConsumer

# Относительные пути — включаются под ws/chat/ в config.routing
websocket_urlpatterns = [
    path('<str:room_name>/', ChatConsumer.as_asgi()),
]
