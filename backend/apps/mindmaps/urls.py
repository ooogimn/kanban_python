"""
URLs for Mind Maps API.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import MindMapViewSet

router = NoFormatSuffixRouter()
router.register(r'maps', MindMapViewSet, basename='mindmap')

urlpatterns = [
    path('', include(router.urls)),
]
