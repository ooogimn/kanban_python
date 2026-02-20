"""
Модели приложения блога.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _


class Category(models.Model):
    """Категория статей блога."""
    name = models.CharField(max_length=100, verbose_name=_('Name'))
    slug = models.SlugField(max_length=100, unique=True, verbose_name=_('Slug'))
    sort_order = models.PositiveSmallIntegerField(default=0, verbose_name=_('Sort order'))

    class Meta:
        verbose_name = 'Категория блога'
        verbose_name_plural = 'Категории блога'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Tag(models.Model):
    """Тег для статей блога."""
    name = models.CharField(max_length=50, unique=True, verbose_name=_('Name'))
    slug = models.SlugField(max_length=50, unique=True, verbose_name=_('Slug'))

    class Meta:
        verbose_name = 'Тег блога'
        verbose_name_plural = 'Теги блога'
        ordering = ['name']

    def __str__(self):
        return self.name


class Post(models.Model):
    """Запись блога (новости, статьи)."""

    title = models.CharField(
        max_length=255,
        verbose_name=_('Title'),
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        blank=True,
        verbose_name=_('Slug'),
        help_text=_('URL-friendly identifier (auto from title if empty)'),
    )
    excerpt = models.TextField(
        blank=True,
        verbose_name=_('Excerpt'),
        help_text=_('Short summary for SEO and list previews'),
    )
    content = models.TextField(
        verbose_name=_('Content'),
        help_text=_('Main text (Markdown supported)'),
    )
    image = models.ImageField(
        upload_to='blog/%Y/%m/',
        null=True,
        blank=True,
        verbose_name=_('Image'),
    )
    video = models.FileField(
        upload_to='blog/%Y/%m/',
        null=True,
        blank=True,
        verbose_name=_('Video'),
        help_text=_('Главное видео поста (если задано, может отображаться вместо изображения)'),
    )
    main_media_autoplay = models.BooleanField(
        default=True,
        verbose_name=_('Autoplay main media'),
        help_text=_('Автовоспроизведение для главного видео'),
    )
    is_published = models.BooleanField(
        default=False,
        verbose_name=_('Is published'),
    )
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Published at'),
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='posts',
        verbose_name=_('Category'),
    )
    tags = models.ManyToManyField(
        Tag,
        related_name='posts',
        blank=True,
        verbose_name=_('Tags'),
    )
    views_count = models.PositiveIntegerField(
        default=0,
        verbose_name=_('Views count'),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at'),
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at'),
    )

    class Meta:
        verbose_name = 'Запись блога'
        verbose_name_plural = 'Записи блога'
        ordering = ['-published_at', '-created_at']

    def __str__(self):
        return self.title
