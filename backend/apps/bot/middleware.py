"""
Middleware для бота (aiogram).
Пока пустой — можно добавить логирование, rate limit и т.д.
"""
from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject


class LoggingMiddleware(BaseMiddleware):
    """Middleware для логирования входящих обновлений."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any]
    ) -> Any:
        # Можно добавить логирование
        return await handler(event, data)
