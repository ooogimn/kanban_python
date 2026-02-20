"""
Сигналы блога — заготовка уведомления в Telegram при публикации.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Post

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Post)
def on_post_save(sender, instance, created, **kwargs):
    """При создании и публикации поста — заготовка для отправки в Telegram."""
    if created and instance.is_published:
        logger.info("TODO: Send post <%s> to Telegram", instance.title)
        print("TODO: Send post", repr(instance.title), "to Telegram")  # noqa: T201
