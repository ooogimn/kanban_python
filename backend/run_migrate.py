#!/usr/bin/env python
"""
Скрипт для запуска миграций с правильной кодировкой на Windows.
"""
import os
import sys

# Устанавливаем кодировку UTF-8 перед любыми импортами
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    # Переконфигурируем stdout/stderr
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

# Теперь импортируем Django
import django
from django.core.management import execute_from_command_line

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
    django.setup()
    execute_from_command_line(['manage.py', 'migrate'])
