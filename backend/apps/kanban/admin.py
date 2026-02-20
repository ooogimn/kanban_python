"""
Admin configuration for kanban app.
"""
from django.contrib import admin
from .models import Stage, Column


@admin.register(Stage)
class StageAdmin(admin.ModelAdmin):
    """Admin для модели Stage (этап / доска)."""
    list_display = ['name', 'project', 'is_default', 'progress', 'health_status', 'created_at']
    list_filter = ['is_default', 'health_status', 'created_at']
    search_fields = ['name']


@admin.register(Column)
class ColumnAdmin(admin.ModelAdmin):
    """Admin для модели Column."""
    list_display = ['name', 'stage', 'column_type', 'system_type', 'position', 'wip_limit']
    list_filter = ['column_type', 'system_type', 'stage']
    ordering = ['stage', 'position']
