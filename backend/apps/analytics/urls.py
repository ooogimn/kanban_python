"""
URLs for analytics app.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import AnalyticsViewSet

router = NoFormatSuffixRouter()
router.register(r'', AnalyticsViewSet, basename='analytics')

urlpatterns = [
    path('', include(router.urls)),
]
