"""
Сервисы бота: отправка сообщений, работа с Redis-контекстом.
"""
import json
import logging
from typing import Optional

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CONTEXT_TTL = 3600  # 1 час
LINK_TTL = 3600    # 1 час для Deep Link токена
CONTEXT_KEY_PREFIX = 'telegram_user'
CONTEXT_SUFFIX = 'context'
LINK_KEY_PREFIX = 'telegram_link'
BOT_CODE_PREFIX = 'telegram_bot_code'
BOT_CODE_TTL = 900  # 15 минут — код из бота для ввода на сайте


def _get_redis():
    """Получить Redis-клиент через Django cache."""
    return cache


def get_context_key(telegram_id: int) -> str:
    """Ключ контекста для пользователя."""
    return f'{CONTEXT_KEY_PREFIX}:{telegram_id}:{CONTEXT_SUFFIX}'


def get_link_key(token: str) -> str:
    """Ключ для Deep Link токена."""
    return f'{LINK_KEY_PREFIX}:{token}'


def get_context(telegram_id: int) -> Optional[dict]:
    """
    Получить контекст пользователя из Redis.
    Возвращает {"entity_type": "task", "entity_id": 123} или None.
    """
    key = get_context_key(telegram_id)
    data = cache.get(key)
    if not data:
        return None
    try:
        return json.loads(data) if isinstance(data, str) else data
    except (json.JSONDecodeError, TypeError):
        return None


def set_context(telegram_id: int, entity_type: str, entity_id: int, ttl: int = CONTEXT_TTL) -> None:
    """Записать контекст в Redis."""
    key = get_context_key(telegram_id)
    data = json.dumps({'entity_type': entity_type, 'entity_id': entity_id})
    cache.set(key, data, ttl)


def clear_context(telegram_id: int) -> None:
    """Очистить контекст пользователя."""
    cache.delete(get_context_key(telegram_id))


def set_link_token(token: str, user_id: int, ttl: int = LINK_TTL) -> None:
    """Сохранить токен связывания (Deep Link) в Redis."""
    cache.set(get_link_key(token), str(user_id), ttl)


def get_user_id_from_link_token(token: str) -> Optional[int]:
    """Получить user_id по токену Deep Link."""
    data = cache.get(get_link_key(token))
    if data is None:
        return None
    try:
        return int(data)
    except (ValueError, TypeError):
        return None


def clear_link_token(token: str) -> None:
    """Удалить токен после использования."""
    cache.delete(get_link_key(token))


def get_bot_code_key(code: str) -> str:
    """Ключ для кода, выданного ботом (пользователь вводит на сайте)."""
    return f'{BOT_CODE_PREFIX}:{code}'


def set_bot_link_code(code: str, telegram_id: int, telegram_username: str, ttl: int = BOT_CODE_TTL) -> None:
    """Сохранить код связывания: бот выдал код, пользователь введёт на сайте."""
    data = json.dumps({'telegram_id': telegram_id, 'telegram_username': telegram_username})
    cache.set(get_bot_code_key(code), data, ttl)


def get_bot_link_code(code: str) -> Optional[dict]:
    """Получить telegram_id и telegram_username по коду из бота. None если истёк/неверный."""
    data = cache.get(get_bot_code_key(code))
    if not data:
        return None
    try:
        return json.loads(data) if isinstance(data, str) else data
    except (json.JSONDecodeError, TypeError):
        return None


def clear_bot_link_code(code: str) -> None:
    """Удалить код после успешной привязки на сайте."""
    cache.delete(get_bot_code_key(code))


def send_telegram_message(
    user_id: int,
    text: str,
    context_key: Optional[str] = None,
    ttl: int = CONTEXT_TTL
) -> bool:
    """
    Отправить сообщение пользователю в Telegram и (опционально) записать контекст в Redis.

    :param user_id: ID пользователя в системе (core.User.id) — нужен telegram_id
    :param text: Текст сообщения
    :param context_key: Ключ контекста, например "task_15" — после отправки
        следующий ответ пользователя боту станет комментарием к этой сущности
    :param ttl: Время жизни контекста в секундах
    :return: True если успешно
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    from .services_telegram import _send_via_api

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.warning('send_telegram_message: User id=%s not found', user_id)
        return False

    telegram_id = getattr(user, 'telegram_id', None)
    if not telegram_id:
        logger.warning('send_telegram_message: User id=%s has no telegram_id', user_id)
        return False

    sent = _send_via_api(telegram_id, text)
    if not sent:
        return False

    if context_key:
        parts = context_key.split('_', 1)
        if len(parts) == 2:
            entity_type, entity_id_str = parts
            try:
                entity_id = int(entity_id_str)
                set_context(telegram_id, entity_type, entity_id, ttl)
            except ValueError:
                pass

    return True
