"""
WebSocket routing configuration.
"""
from django.urls import path
from channels.routing import URLRouter
from apps.chat.routing import websocket_urlpatterns as chat_ws_patterns
from apps.notifications.consumers import (
    DashboardConsumer,
    KanbanConsumer,
    ProjectConsumer,
)

websocket_urlpatterns = [
    path('ws/dashboard/', DashboardConsumer.as_asgi()),
    path('ws/kanban/<int:board_id>/', KanbanConsumer.as_asgi()),
    path('ws/project/<int:project_id>/', ProjectConsumer.as_asgi()),
    # Чат: ws/chat/<room_name>/ (task_15, project_7, file_123)
    path('ws/chat/', URLRouter(chat_ws_patterns)),
]
