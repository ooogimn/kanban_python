from django.urls import path, include
from django.db import connection
from django.core.cache import cache
from config.routers import NoFormatSuffixRouter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status as http_status
from .views import WorkspaceViewSet, UserViewSet
from .api.views import DashboardStatsView, ProjectMemberViewSet
from apps.auth.views import profile_me

router = NoFormatSuffixRouter()
router.register(r'workspaces', WorkspaceViewSet, basename='workspace')
router.register(r'users', UserViewSet, basename='user')
router.register(r'project-members', ProjectMemberViewSet, basename='project-member')


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint (без авторизации).
    Проверяет доступ к БД (обязательно) и Redis/кэшу (опционально).
    При недоступности БД возвращает 503.
    """
    payload = {'status': 'ok', 'service': 'Office Suite 360 API'}

    # Проверка БД (обязательно)
    try:
        connection.ensure_connection()
        payload['db'] = 'ok'
    except Exception:
        return Response(
            {'status': 'error', 'detail': 'db_unavailable', 'service': 'Office Suite 360 API'},
            status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Проверка Redis/кэша (опционально — не ломаем health при недоступности Redis)
    try:
        cache.set('health_check_ping', 1, 5)
        if cache.get('health_check_ping') == 1:
            payload['redis'] = 'ok'
        else:
            payload['redis'] = 'unavailable'
    except Exception:
        payload['redis'] = 'unavailable'

    return Response(payload)


urlpatterns = [
    path('', health_check, name='health-check'),
    path('me/', profile_me, name='profile_me'),
    path('dashboard-stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('', include(router.urls)),
]
