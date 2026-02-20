"""
Documents models for Office Suite 360.
"""
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinLengthValidator
from apps.core.models import User, Workspace
from .utils import get_upload_path, get_file_type


class Tag(models.Model):
    """Тег."""
    
    name = models.CharField(
        max_length=100,
        verbose_name=_('Name')
    )
    color = models.CharField(
        max_length=7,
        default='#3788d8',
        verbose_name=_('Color')
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='tags',
        verbose_name=_('Workspace')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    
    class Meta:
        verbose_name = 'Тег'
        verbose_name_plural = 'Теги'
        db_table = 'tags'
        unique_together = [['name', 'workspace']]
        indexes = [
            models.Index(fields=['workspace']),
        ]
    
    def __str__(self):
        return self.name


class Comment(models.Model):
    """Комментарий с поддержкой ответов (threaded comments)."""
    
    content = models.TextField(
        verbose_name=_('Content'),
        validators=[MinLengthValidator(1)]
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name=_('Author')
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        related_name='replies',
        null=True,
        blank=True,
        verbose_name=_('Parent Comment')
    )
    # Обратная совместимость: workitem остается для существующих комментариев
    workitem = models.ForeignKey(
        'todo.WorkItem',
        on_delete=models.CASCADE,
        related_name='comments',
        null=True,
        blank=True,
        verbose_name=_('Work Item (Legacy)')
    )
    # GenericForeignKey для поддержки комментирования разных сущностей
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name=_('Content Type')
    )
    object_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name=_('Object ID')
    )
    content_object = GenericForeignKey('content_type', 'object_id')
    is_edited = models.BooleanField(
        default=False,
        verbose_name=_('Is Edited')
    )
    edited_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Edited At')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at')
    )
    
    class Meta:
        verbose_name = 'Комментарий'
        verbose_name_plural = 'Комментарии'
        db_table = 'comments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workitem', 'created_at']),
            models.Index(fields=['content_type', 'object_id', 'created_at']),
            models.Index(fields=['author']),
            models.Index(fields=['parent']),
        ]
    
    def __str__(self):
        if self.workitem:
            return f"Comment by {self.author} on {self.workitem.title[:50]}"
        elif self.content_object:
            return f"Comment by {self.author} on {self.content_type.model}#{self.object_id}"
        else:
            return f"Comment by {self.author}"
    
    def save(self, *args, **kwargs):
        # Автоматически определяем content_type и object_id из workitem для обратной совместимости
        if self.workitem and not self.content_type:
            self.content_type = ContentType.objects.get_for_model(self.workitem)
            self.object_id = self.workitem.id
        super().save(*args, **kwargs)


class Attachment(models.Model):
    """Вложение с поддержкой прикрепления к разным сущностям."""
    
    FILE_TYPE_DOCUMENT = 'document'
    FILE_TYPE_IMAGE = 'image'
    FILE_TYPE_VIDEO = 'video'
    FILE_TYPE_AUDIO = 'audio'
    FILE_TYPE_ARCHIVE = 'archive'
    FILE_TYPE_OTHER = 'other'
    
    FILE_TYPE_CHOICES = [
        (FILE_TYPE_DOCUMENT, _('Document')),
        (FILE_TYPE_IMAGE, _('Image')),
        (FILE_TYPE_VIDEO, _('Video')),
        (FILE_TYPE_AUDIO, _('Audio')),
        (FILE_TYPE_ARCHIVE, _('Archive')),
        (FILE_TYPE_OTHER, _('Other')),
    ]
    
    file = models.FileField(
        upload_to=get_upload_path,
        verbose_name=_('File')
    )
    filename = models.CharField(
        max_length=255,
        verbose_name=_('Filename')
    )
    size = models.BigIntegerField(
        verbose_name=_('Size (bytes)')
    )
    mime_type = models.CharField(
        max_length=100,
        verbose_name=_('MIME Type')
    )
    file_type = models.CharField(
        max_length=20,
        choices=FILE_TYPE_CHOICES,
        default=FILE_TYPE_OTHER,
        verbose_name=_('File Type')
    )
    # Обратная совместимость: workitem остается для существующих вложений
    workitem = models.ForeignKey(
        'todo.WorkItem',
        on_delete=models.CASCADE,
        related_name='attachments',
        null=True,
        blank=True,
        verbose_name=_('Work Item (Legacy)')
    )
    # GenericForeignKey для поддержки прикрепления к разным сущностям
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name=_('Content Type')
    )
    object_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name=_('Object ID')
    )
    content_object = GenericForeignKey('content_type', 'object_id')
    # Прямая связь с проектом для быстрого доступа
    project = models.ForeignKey(
        'todo.Project',
        on_delete=models.CASCADE,
        related_name='attachments',
        null=True,
        blank=True,
        verbose_name=_('Project')
    )
    is_public = models.BooleanField(
        default=False,
        verbose_name=_('Is Public')
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='uploaded_attachments',
        verbose_name=_('Uploaded By')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    
    class Meta:
        verbose_name = 'Вложение'
        verbose_name_plural = 'Вложения'
        db_table = 'attachments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workitem']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['project']),
            models.Index(fields=['uploaded_by']),
            models.Index(fields=['file_type']),
        ]
    
    def __str__(self):
        return self.filename
    
    def save(self, *args, **kwargs):
        # Автоматически определяем file_type из mime_type
        if self.mime_type and not self.file_type:
            self.file_type = get_file_type(self.mime_type)
        
        # Автоматически определяем content_type и object_id из workitem для обратной совместимости
        if self.workitem and not self.content_type:
            self.content_type = ContentType.objects.get_for_model(self.workitem)
            self.object_id = self.workitem.id
        
        # Автоматически определяем project
        if not self.project:
            if self.workitem and self.workitem.project:
                self.project = self.workitem.project
            elif self.content_object:
                # Пытаемся получить project из связанного объекта
                if hasattr(self.content_object, 'project'):
                    self.project = self.content_object.project
                elif hasattr(self.content_object, 'related_workitem') and self.content_object.related_workitem:
                    if self.content_object.related_workitem.project:
                        self.project = self.content_object.related_workitem.project
        
        super().save(*args, **kwargs)


class WikiPage(models.Model):
    """Страница Wiki (записка) с поддержкой иерархии. Может быть без проекта/задачи, с последующей привязкой."""
    
    title = models.CharField(
        max_length=255,
        verbose_name=_('Title')
    )
    content = models.TextField(
        blank=True,
        verbose_name=_('Content')
    )
    slug = models.SlugField(
        max_length=255,
        verbose_name=_('Slug')
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.SET_NULL,
        related_name='wiki_pages',
        null=True,
        blank=True,
        verbose_name=_('Workspace')
    )
    project = models.ForeignKey(
        'todo.Project',
        on_delete=models.SET_NULL,
        related_name='wiki_pages',
        null=True,
        blank=True,
        verbose_name=_('Project')
    )
    workitem = models.ForeignKey(
        'todo.WorkItem',
        on_delete=models.SET_NULL,
        related_name='linked_wiki_pages',
        null=True,
        blank=True,
        verbose_name=_('Linked Task')
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        related_name='children',
        null=True,
        blank=True,
        verbose_name=_('Parent Page')
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='wiki_pages',
        verbose_name=_('Author')
    )
    is_published = models.BooleanField(
        default=True,
        verbose_name=_('Is Published')
    )
    order = models.IntegerField(
        default=0,
        verbose_name=_('Order')
    )
    color = models.CharField(
        max_length=7,
        blank=True,
        default='',
        verbose_name=_('Color')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at')
    )
    
    # M2M связи
    attachments = models.ManyToManyField(
        Attachment,
        related_name='wiki_pages',
        blank=True,
        verbose_name=_('Attachments')
    )
    tags = models.ManyToManyField(
        Tag,
        related_name='wiki_pages',
        blank=True,
        verbose_name=_('Tags')
    )
    watchers = models.ManyToManyField(
        User,
        related_name='watched_wiki_pages',
        blank=True,
        verbose_name=_('Watchers')
    )
    
    class Meta:
        verbose_name = 'Страница вики'
        verbose_name_plural = 'Страницы вики'
        db_table = 'wiki_pages'
        ordering = ['order', 'title']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'slug'],
                condition=models.Q(project__isnull=False),
                name='wiki_project_slug_uniq',
            ),
            models.UniqueConstraint(
                fields=['workspace', 'slug'],
                condition=models.Q(project__isnull=True, workspace__isnull=False),
                name='wiki_workspace_slug_uniq',
            ),
            models.UniqueConstraint(
                fields=['author', 'slug'],
                condition=models.Q(project__isnull=True, workspace__isnull=True),
                name='wiki_personal_slug_uniq',
            ),
        ]
        indexes = [
            models.Index(fields=['project', 'slug']),
            models.Index(fields=['project', 'parent', 'order']),
            models.Index(fields=['workspace']),
            models.Index(fields=['workitem']),
            models.Index(fields=['author']),
            models.Index(fields=['is_published']),
        ]
    
    def __str__(self):
        return self.title
    
    def get_full_path(self):
        """Возвращает полный путь страницы в иерархии."""
        path = [self.title]
        parent = self.parent
        while parent:
            path.insert(0, parent.title)
            parent = parent.parent
        return ' / '.join(path)