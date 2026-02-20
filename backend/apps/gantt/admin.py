"""
Admin configuration for gantt app.
"""
from django.contrib import admin
from .models import GanttTask, GanttDependency


@admin.register(GanttTask)
class GanttTaskAdmin(admin.ModelAdmin):
    """Admin для модели GanttTask."""
    list_display = ['name', 'start_date', 'end_date', 'progress', 'related_workitem', 'parent', 'created_at']
    list_filter = ['start_date', 'created_at']
    search_fields = ['name']
    date_hierarchy = 'start_date'


@admin.register(GanttDependency)
class GanttDependencyAdmin(admin.ModelAdmin):
    """Admin для модели GanttDependency."""
    list_display = ['predecessor', 'successor', 'type', 'lag', 'created_at']
    list_filter = ['type', 'created_at']
    search_fields = ['predecessor__name', 'successor__name']
