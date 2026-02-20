"""
Admin configuration for schedule app.
"""
from django.contrib import admin
from .models import Resource, ScheduleEntry


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    """Admin для модели Resource."""
    list_display = ['name', 'created_at']
    search_fields = ['name', 'description']


@admin.register(ScheduleEntry)
class ScheduleEntryAdmin(admin.ModelAdmin):
    """Admin для модели ScheduleEntry."""
    list_display = ['date', 'time', 'duration', 'repeat_pattern', 'related_workitem', 'resource', 'created_at']
    list_filter = ['repeat_pattern', 'date', 'created_at']
    date_hierarchy = 'date'
    search_fields = ['related_workitem__title']
