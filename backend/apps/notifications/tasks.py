"""
Celery-задачи для отправки уведомлений (Task 3.1).

Telegram и Email отправляются в фоне, чтобы не блокировать интерфейс.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='apps.notifications.tasks.send_telegram_message')
def send_telegram_message(user_id: int, text: str) -> bool:
    """
    Отправить сообщение пользователю в Telegram (в фоне).
    
    :param user_id: ID пользователя (User.id), у пользователя должен быть telegram_id.
    :param text: Текст сообщения.
    :return: True если отправлено успешно.
    """
    try:
        from apps.bot.services import send_telegram_message as bot_send
        return bot_send(user_id, text)
    except Exception as e:
        logger.warning('send_telegram_message task failed user_id=%s: %s', user_id, e)
        return False


@shared_task(name='apps.notifications.tasks.send_email_message')
def send_email_message(to_email: str, subject: str, body: str) -> bool:
    """
    Отправить email (в фоне).
    
    :param to_email: Адрес получателя.
    :param subject: Тема письма.
    :param body: Текст письма.
    :return: True если отправлено успешно.
    """
    try:
        from django.core.mail import send_mail
        from django.conf import settings
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com'),
            recipient_list=[to_email],
            fail_silently=True,
        )
        return True
    except Exception as e:
        logger.warning('send_email_message task failed to=%s: %s', to_email, e)
        return False
