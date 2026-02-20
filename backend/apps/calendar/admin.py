"""
Admin configuration for calendar app.
"""
from django.contrib import admin
from .models import CalendarEvent


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    """Admin для модели CalendarEvent."""
    list_display = ['title', 'owner', 'start_date', 'end_date', 'all_day', 'related_workitem', 'created_at']
    list_filter = ['all_day', 'created_at', 'start_date']
    search_fields = ['title', 'description', 'location']
    date_hierarchy = 'start_date'
    filter_horizontal = ['attendees']
