"""
URLs for schedule app.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import ResourceViewSet, ScheduleEntryViewSet

router = NoFormatSuffixRouter()
router.register(r'resources', ResourceViewSet, basename='resource')
router.register(r'entries', ScheduleEntryViewSet, basename='scheduleentry')

urlpatterns = [
    path('', include(router.urls)),
]
