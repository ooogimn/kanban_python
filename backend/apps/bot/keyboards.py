"""
Клавиатуры для Telegram-бота.
"""
from django.conf import settings
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo


def reply_keyboard(entity_type: str, entity_id: int) -> InlineKeyboardMarkup:
    """Клавиатура с кнопкой «Ответить» — устанавливает контекст в Redis при callback."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text='💬 Ответить',
            callback_data=f'reply_{entity_type}_{entity_id}'
        )],
    ])


def open_app_keyboard() -> InlineKeyboardMarkup:
    """Клавиатура с кнопкой «Open App». HTTPS — как Mini App, HTTP (localhost) — ссылка в браузер."""
    frontend_url = getattr(settings, 'FRONTEND_URL', '') or 'http://localhost:3000'
    # Telegram разрешает только HTTPS для Web App (Mini App); для localhost — обычная ссылка
    if frontend_url.startswith('https://'):
        button = InlineKeyboardButton(text='🌐 Open App', web_app=WebAppInfo(url=frontend_url))
    else:
        button = InlineKeyboardButton(text='🌐 Open App', url=frontend_url)
    return InlineKeyboardMarkup(inline_keyboard=[[button]])
