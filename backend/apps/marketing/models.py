"""
Модели рекламной сети — баннеры по слотам.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _


class Advertisement(models.Model):
    """Рекламный блок (баннер) для отображения в слотах интерфейса."""

    SLOT_SIDEBAR = 'sidebar'
    SLOT_FOOTER_COL_1 = 'footer_col_1'
    SLOT_FOOTER_COL_2 = 'footer_col_2'
    SLOT_FOOTER_COL_3 = 'footer_col_3'
    SLOT_BLOG_CONTENT = 'blog_content'

    SLOT_CHOICES = [
        (SLOT_SIDEBAR, _('Sidebar')),
        (SLOT_FOOTER_COL_1, _('Footer column 1')),
        (SLOT_FOOTER_COL_2, _('Footer column 2')),
        (SLOT_FOOTER_COL_3, _('Footer column 3')),
        (SLOT_BLOG_CONTENT, _('Blog (inside article)')),
    ]

    CONTENT_IMAGE = 'image'
    CONTENT_HTML = 'html'
    CONTENT_VIDEO = 'video'

    CONTENT_TYPE_CHOICES = [
        (CONTENT_IMAGE, _('Image')),
        (CONTENT_HTML, _('HTML')),
        (CONTENT_VIDEO, _('Video')),
    ]

    title = models.CharField(
        max_length=255,
        verbose_name=_('Title'),
        help_text=_('Внутреннее название для админки'),
    )
    slot = models.CharField(
        max_length=32,
        choices=SLOT_CHOICES,
        verbose_name=_('Slot'),
    )
    content_type = models.CharField(
        max_length=16,
        choices=CONTENT_TYPE_CHOICES,
        default=CONTENT_IMAGE,
        verbose_name=_('Content type'),
    )
    image = models.ImageField(
        upload_to='ads/%Y/%m/',
        null=True,
        blank=True,
        verbose_name=_('Image'),
    )
    video = models.FileField(
        upload_to='ads/%Y/%m/',
        null=True,
        blank=True,
        verbose_name=_('Video'),
        help_text=_('Используется при content_type=video'),
    )
    html_code = models.TextField(
        blank=True,
        verbose_name=_('HTML code'),
        help_text=_('Используется при content_type=html'),
    )
    link = models.URLField(
        max_length=512,
        blank=True,
        verbose_name=_('Link'),
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Is active'),
    )
    width = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name=_('Width (px)'),
        help_text=_('Рекомендуемая ширина в пикселях'),
    )
    height = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name=_('Height (px)'),
        help_text=_('Рекомендуемая высота в пикселях'),
    )
    sort_order = models.PositiveSmallIntegerField(
        default=0,
        verbose_name=_('Sort order'),
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
        verbose_name = 'Рекламный блок'
        verbose_name_plural = 'Рекламные блоки'
        ordering = ['slot', 'sort_order', 'id']

    def __str__(self):
        return f"{self.title} ({self.get_slot_display()})"
