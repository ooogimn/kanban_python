"""
URLs for gantt app.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import GanttTaskViewSet, GanttDependencyViewSet, GanttViewSet

router = NoFormatSuffixRouter()
router.register(r'tasks', GanttTaskViewSet, basename='gantttask')
router.register(r'dependencies', GanttDependencyViewSet, basename='ganttdependency')
router.register(r'', GanttViewSet, basename='gantt')

urlpatterns = [
    path('', include(router.urls)),
]
