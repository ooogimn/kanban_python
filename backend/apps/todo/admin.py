"""
Admin configuration for todo app.
"""
from django.contrib import admin
from .models import Project, WorkItem, ChecklistItem, TaskDependency


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    """Admin для модели Project."""
    list_display = ['name', 'workspace', 'status', 'owner', 'start_date', 'end_date', 'created_at']
    list_filter = ['status', 'created_at', 'workspace']
    search_fields = ['name', 'description']
    date_hierarchy = 'created_at'


@admin.register(WorkItem)
class WorkItemAdmin(admin.ModelAdmin):
    """Admin для модели WorkItem."""
    list_display = ['title', 'status', 'priority', 'project', 'due_date', 'progress', 'created_at']
    list_filter = ['status', 'priority', 'created_at', 'due_date']
    search_fields = ['title', 'description']
    date_hierarchy = 'created_at'
    filter_horizontal = ['assigned_to', 'watchers', 'tags', 'dependencies']
    readonly_fields = ['created_at', 'updated_at', 'version']


@admin.register(ChecklistItem)
class ChecklistItemAdmin(admin.ModelAdmin):
    """Admin для подзадач (чек-лист)."""
    list_display = ['title', 'workitem', 'is_done', 'sort_order']
    list_filter = ['is_done']
    search_fields = ['title']
    ordering = ['workitem', 'sort_order', 'id']


@admin.register(TaskDependency)
class TaskDependencyAdmin(admin.ModelAdmin):
    """Admin для зависимостей задач (Умный Гант)."""
    list_display = ['id', 'predecessor', 'successor', 'type', 'lag_days', 'created_at']
    list_filter = ['type']
    search_fields = ['predecessor__title', 'successor__title']
