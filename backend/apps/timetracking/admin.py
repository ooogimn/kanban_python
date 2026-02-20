"""
Admin configuration for timetracking app.
"""
from django.contrib import admin
from .models import TimeLog


@admin.register(TimeLog)
class TimeLogAdmin(admin.ModelAdmin):
    """Admin для модели TimeLog."""
    list_display = ['user', 'workitem', 'started_at', 'stopped_at', 'duration_minutes', 'billable', 'created_at']
    list_filter = ['billable', 'started_at', 'created_at']
    search_fields = ['workitem__title', 'description', 'user__username']
    date_hierarchy = 'started_at'
