"""
Точка входа для запуска Telegram-бота (aiogram 3.x).
Для dev: python manage.py runbot или python -m apps.bot.main (после django.setup).
"""
import asyncio
import os
import sys

# Добавляем корень проекта в path для импорта Django
if __name__ == '__main__':
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    import django
    django.setup()


async def run_polling():
    from django.conf import settings
    from aiogram import Bot, Dispatcher
    from aiogram.client.default import DefaultBotProperties
    from aiogram.enums import ParseMode
    from apps.bot import handlers as bot_handlers

    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None) or os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not token:
        raise SystemExit('TELEGRAM_BOT_TOKEN не задан. Добавьте в .env или settings.')

    bot = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(bot_handlers.router)

    print('Бот запущен (polling). Ctrl+C для остановки.')
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


def main():
    asyncio.run(run_polling())


if __name__ == '__main__':
    main()
