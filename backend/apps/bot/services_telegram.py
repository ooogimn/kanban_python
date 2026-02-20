"""
Низкоуровневая отправка в Telegram (aiogram/requests).
Используется из services.py и handlers.
"""
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _send_via_api(chat_id: int, text: str, parse_mode: str = 'HTML') -> bool:
    """Отправка через Telegram Bot API."""
    import requests

    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None) or ''
    if not token:
        logger.error('TELEGRAM_BOT_TOKEN not set')
        return False

    url = f'https://api.telegram.org/bot{token}/sendMessage'
    try:
        resp = requests.post(
            url,
            json={'chat_id': chat_id, 'text': text, 'parse_mode': parse_mode},
            timeout=10,
        )
        if resp.status_code == 200:
            return True
        logger.error('Telegram API: %s %s', resp.status_code, resp.text)
        return False
    except Exception as e:
        logger.exception('Telegram send error: %s', e)
        return False
