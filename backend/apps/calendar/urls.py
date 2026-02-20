"""
URLs for calendar app.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import CalendarEventViewSet

router = NoFormatSuffixRouter()
router.register(r'events', CalendarEventViewSet, basename='calendarevent')

urlpatterns = [
    path('', include(router.urls)),
]
