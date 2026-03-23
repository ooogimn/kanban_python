"""
Обработчики команд и сообщений Telegram-бота.
"""
import logging
import secrets
from aiogram import Bot, F, Router
from aiogram.types import Message, CallbackQuery
from aiogram.filters import CommandStart
from asgiref.sync import sync_to_async

from .services import (
    get_context,
    set_context,
    clear_context,
    get_user_id_from_link_token,
    clear_link_token,
    set_bot_link_code,
)
from .keyboards import reply_keyboard, open_app_keyboard

logger = logging.getLogger(__name__)

router = Router()


@sync_to_async
def _link_telegram_to_user(user_id: int, telegram_id: int, telegram_username: str) -> bool:
    """Связать telegram_id с пользователем. Возвращает True при успехе."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
        user.telegram_id = telegram_id
        user.telegram_username = telegram_username or ''
        user.save(update_fields=['telegram_id', 'telegram_username'])
        return True
    except User.DoesNotExist:
        return False


@router.message(CommandStart())
async def cmd_start(message: Message, bot: Bot):
    """Команда /start. Deep Linking: t.me/Bot?start=TOKEN или выдача кода для ввода на сайте."""
    args = message.text.split(maxsplit=1)[1:] if message.text else []
    token = args[0] if args else None

    telegram_id = message.from_user.id
    telegram_username = message.from_user.username or ''
    keyboard = open_app_keyboard()

    if token:
        # Deep Link: связывание аккаунта (ссылка с сайта)
        user_id = get_user_id_from_link_token(token)
        if user_id is not None:
            ok = await _link_telegram_to_user(user_id, telegram_id, telegram_username)
            if ok:
                clear_link_token(token)
                from django.contrib.auth import get_user_model
                User = get_user_model()
                user = await sync_to_async(User.objects.get)(id=user_id)
                name = user.first_name or user.username or 'пользователь'
                await message.answer(
                    f"✅ Аккаунт успешно связан!\n\n"
                    f"Добро пожаловать, {name}.\n\n"
                    f"Вы будете получать уведомления о задачах и комментариях.\n"
                    f"Откройте задачу в веб-интерфейсе и нажмите «Ответить» — "
                    f"ваш ответ появится как комментарий.",
                    reply_markup=keyboard,
                )
            else:
                await message.answer("⚠️ Токен истёк или недействителен.", reply_markup=keyboard)
        else:
            await message.answer(
                "⚠️ Токен истёк или недействителен. Получите новую ссылку в веб-интерфейсе.",
                reply_markup=keyboard,
            )
    else:
        # Обычный /start: выдаём код для ввода на сайте (альтернатива ссылке)
        code = f"start_{secrets.token_urlsafe(12)}"
        set_bot_link_code(code, telegram_id, telegram_username)
        await message.answer(
            "👋 Добро пожаловать в Office Suite 360 Bot!\n\n"
            f"Ваш код для привязки аккаунта: <code>{code}</code>\n\n"
            "Введите этот код на сайте: Профиль → Привязать Telegram.\n\n"
            "Либо перейдите по ссылке из веб-интерфейса (Профиль → Привязать Telegram).\n\n"
            "Вы будете получать уведомления о задачах. Кнопка ниже открывает веб-приложение.",
            reply_markup=keyboard,
        )


@router.callback_query(F.data.startswith('reply_'))
async def callback_reply(callback: CallbackQuery, bot: Bot):
    """Callback: кнопка «Ответить» — установить контекст."""
    data = callback.data
    # reply_task_123 или reply_project_7
    parts = data.split('_', 2)
    if len(parts) != 3:
        await callback.answer()
        return

    _, entity_type, entity_id_str = parts
    try:
        entity_id = int(entity_id_str)
    except ValueError:
        await callback.answer()
        return

    telegram_id = callback.from_user.id
    set_context(telegram_id, entity_type, entity_id)

    await callback.answer()
    await callback.message.answer(
        f"💬 Напишите комментарий к {entity_type} #{entity_id}:"
    )


@router.message(F.text)
async def handle_text(message: Message, bot: Bot):
    """Обработка текстовых сообщений — создание комментария по контексту."""
    telegram_id = message.from_user.id
    text = (message.text or '').strip()

    if not text:
        return

    ctx = get_context(telegram_id)
    if not ctx:
        await message.answer(
            "Откройте задачу в веб-интерфейсе и нажмите «Ответить» в уведомлении, "
            "чтобы оставить комментарий."
        )
        return

    entity_type = ctx.get('entity_type')
    entity_id = ctx.get('entity_id')

    if not entity_type or not entity_id:
        clear_context(telegram_id)
        await message.answer("⚠️ Контекст истёк. Откройте задачу заново.")
        return

    # Создать комментарий (sync Django ORM в async handler)
    from .comment_service import create_comment_from_telegram

    ok, err = await sync_to_async(create_comment_from_telegram)(
        telegram_id=telegram_id,
        entity_type=entity_type,
        entity_id=entity_id,
        text=text,
    )

    if ok:
        clear_context(telegram_id)
        await message.answer("✅ Комментарий добавлен!")
    else:
        await message.answer(f"⚠️ Ошибка: {err or 'Не удалось добавить комментарий'}.")
