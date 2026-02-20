"""
URL configuration for timetracking app.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter

from .views import TimeLogViewSet

router = NoFormatSuffixRouter()
router.register(r'logs', TimeLogViewSet, basename='timelog')

urlpatterns = [
    path('', include(router.urls)),
]
