"""
URLs for todo app.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import ProjectViewSet, WorkItemViewSet, ChecklistItemViewSet

router = NoFormatSuffixRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'tasks', WorkItemViewSet, basename='workitem')
router.register(r'checklist-items', ChecklistItemViewSet, basename='checklistitem')

urlpatterns = [
    path('', include(router.urls)),
]
