#!/usr/bin/env python
"""
Скрипт для создания и применения миграций.
"""
import os
import sys

# Проверка установки Django
try:
    import django
except ImportError:
    print("✗ Django не установлен. Установите зависимости:")
    print("  pip install -r requirements.txt")
    sys.exit(1)

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

try:
    django.setup()
except Exception as e:
    print(f"✗ Ошибка при настройке Django: {e}")
    print("\nВозможные решения:")
    print("1. Установите зависимости: pip install -r requirements.txt")
    print("2. Проверьте настройки в config/settings/")
    print("3. Убедитесь, что база данных создана и настроена в .env")
    sys.exit(1)

from django.core.management import call_command

if __name__ == '__main__':
    print("=" * 50)
    print("Создание и применение миграций")
    print("=" * 50)
    
    print("\n[1/2] Создание миграций...")
    try:
        call_command('makemigrations', verbosity=1)
        print("✓ Миграции созданы успешно")
    except Exception as e:
        print(f"✗ Ошибка при создании миграций: {e}")
        print("\nВозможные причины:")
        print("- Модели содержат ошибки")
        print("- База данных не настроена")
        print("- Отсутствуют необходимые зависимости")
        sys.exit(1)
    
    print("\n[2/2] Применение миграций...")
    try:
        call_command('migrate', verbosity=1)
        print("✓ Миграции применены успешно")
    except Exception as e:
        print(f"✗ Ошибка при применении миграций: {e}")
        print("\nВозможные причины:")
        print("- База данных не создана")
        print("- Неверные настройки подключения в .env")
        print("- PostgreSQL не запущен")
        print("\nПроверьте:")
        print("1. Создана ли база данных PostgreSQL")
        print("2. Правильны ли настройки в .env файле")
        print("3. Запущен ли сервер PostgreSQL")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("✓ Все миграции выполнены успешно!")
    print("=" * 50)
