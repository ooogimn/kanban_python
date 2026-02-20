#!/usr/bin/env python
"""Применение миграций через Django management commands."""
import os
import sys
import django
from pathlib import Path

# Добавляем backend в путь
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_path))
os.chdir(str(backend_path))

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import call_command
from io import StringIO

print("=" * 80)
print("ПРИМЕНЕНИЕ МИГРАЦИЙ")
print("=" * 80)

# Применение миграций
print("\n1. Применение миграций todo:")
try:
    out = StringIO()
    call_command('migrate', 'todo', stdout=out, stderr=out)
    result = out.getvalue()
    print(result)
    
    with open('../migration_result.txt', 'w', encoding='utf-8') as f:
        f.write(result)
    
except Exception as e:
    print(f"ОШИБКА: {e}")
    import traceback
    traceback.print_exc()

# Проверка статуса
print("\n2. Проверка статуса миграций:")
try:
    out = StringIO()
    call_command('showmigrations', 'todo', stdout=out)
    status = out.getvalue()
    print(status)
    
    with open('../migration_status.txt', 'w', encoding='utf-8') as f:
        f.write(status)
        
except Exception as e:
    print(f"ОШИБКА: {e}")

print("\n" + "=" * 80)
print("ЗАВЕРШЕНО")
print("=" * 80)
