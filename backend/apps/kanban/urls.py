"""
URLs for kanban app.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import BoardViewSet, KanbanColumnViewSet

router = NoFormatSuffixRouter()
router.register(r'boards', BoardViewSet, basename='board')
router.register(r'columns', KanbanColumnViewSet, basename='column')

urlpatterns = [
    path('', include(router.urls)),
]
