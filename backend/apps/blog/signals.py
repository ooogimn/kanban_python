"""
Сигналы блога — автозапуск SEO индексации при публикации поста.
"""
import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Post
from .tasks import trigger_search_engine_indexing, autopost_to_social_media

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Post)
def on_post_pre_save(sender, instance, **kwargs):
    """
    Сохраняем предыдущее значение is_published, чтобы понять момент публикации.
    """
    if not instance.pk:
        instance._was_published = False
        return
    prev = Post.objects.filter(pk=instance.pk).only('is_published').first()
    instance._was_published = bool(prev.is_published) if prev else False


@receiver(post_save, sender=Post)
def on_post_save(sender, instance, created, **kwargs):
    """
    При фактической публикации поста запускаем фоновую индексацию.
    """
    became_published = bool(instance.is_published) and (created or not bool(getattr(instance, '_was_published', False)))
    if became_published:
        trigger_search_engine_indexing.delay(instance.id)
        autopost_to_social_media.delay(instance.id)
        logger.info("Triggered SEO indexing and autoposting for post <%s>", instance.title)
