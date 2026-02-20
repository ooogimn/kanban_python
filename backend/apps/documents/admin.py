"""
Admin configuration for documents app.
"""
from django.contrib import admin
from django.contrib.contenttypes.admin import GenericTabularInline
from django.utils.translation import gettext_lazy as _
from .models import Tag, Comment, Attachment, WikiPage


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Admin для модели Tag."""
    list_display = ['name', 'color', 'workspace', 'created_at']
    list_filter = ['workspace', 'created_at']
    search_fields = ['name']


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    """Admin для модели Comment."""
    list_display = ['author', 'get_content_object', 'parent', 'is_edited', 'created_at', 'updated_at']
    list_filter = ['created_at', 'is_edited', 'content_type']
    search_fields = ['content', 'author__username']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'updated_at', 'edited_at']
    
    def get_content_object(self, obj):
        """Возвращает связанный объект."""
        if obj.content_object:
            return f"{obj.content_type.model}#{obj.object_id}"
        elif obj.workitem:
            return f"WorkItem#{obj.workitem.id}"
        return "-"
    get_content_object.short_description = _('Content Object')


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    """Admin для модели Attachment."""
    list_display = ['filename', 'get_content_object', 'project', 'file_type', 'size', 'mime_type', 'is_public', 'uploaded_by', 'created_at']
    list_filter = ['file_type', 'mime_type', 'is_public', 'created_at', 'project']
    search_fields = ['filename', 'project__name']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at']
    
    def get_content_object(self, obj):
        """Возвращает связанный объект."""
        if obj.content_object:
            return f"{obj.content_type.model}#{obj.object_id}"
        elif obj.workitem:
            return f"WorkItem#{obj.workitem.id}"
        return "-"
    get_content_object.short_description = _('Content Object')
@admin.register(WikiPage)
class WikiPageAdmin(admin.ModelAdmin):
    """Admin для модели WikiPage."""
    list_display = ['title', 'project', 'parent', 'author', 'is_published', 'order', 'created_at', 'updated_at']
    list_filter = ['project', 'is_published', 'created_at', 'author']
    search_fields = ['title', 'content', 'slug', 'project__name']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'updated_at']
    filter_horizontal = ['attachments', 'tags', 'watchers']
    prepopulated_fields = {'slug': ('title',)}