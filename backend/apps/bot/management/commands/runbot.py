"""
Management command для запуска Telegram-бота (polling).
Локальная разработка — в продакшене используется webhook.
"""
import asyncio
import logging
import os

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Запуск Telegram-бота (polling, для локальной разработки)'

    def handle(self, *args, **options):
        # Инициализация Django
        import django
        django.setup()

        token = os.environ.get('TELEGRAM_BOT_TOKEN') or getattr(
            __import__('django.conf', fromlist=['settings']).settings,
            'TELEGRAM_BOT_TOKEN',
            ''
        )
        if not token:
            self.stderr.write(self.style.ERROR('TELEGRAM_BOT_TOKEN не задан. Добавьте в .env'))
            return

        asyncio.run(self._run_bot(token))

    async def _run_bot(self, token: str):
        from aiogram import Bot, Dispatcher
        from aiogram.client.default import DefaultBotProperties
        from aiogram.enums import ParseMode
        from apps.bot import handlers as bot_handlers

        bot = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
        dp = Dispatcher()
        dp.include_router(bot_handlers.router)

        self.stdout.write(self.style.SUCCESS('Бот запущен (polling). Ctrl+C для остановки.'))
        try:
            await dp.start_polling(bot)
        finally:
            await bot.session.close()
