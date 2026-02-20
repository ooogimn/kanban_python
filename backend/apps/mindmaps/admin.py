from django.contrib import admin
from .models import MindMap


@admin.register(MindMap)
class MindMapAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'owner', 'workspace', 'project', 'related_workitem', 'is_personal', 'updated_at']
    list_filter = ['is_personal']
    search_fields = ['title']
    raw_id_fields = ['owner', 'workspace', 'project', 'related_workitem']
