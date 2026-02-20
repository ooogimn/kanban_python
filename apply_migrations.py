#!/usr/bin/env python
"""Скрипт для проверки и применения миграций."""
import os
import sys
import subprocess

# Переход в директорию backend
os.chdir('backend')

print("=" * 80)
print("ПРОВЕРКА И ПРИМЕНЕНИЕ МИГРАЦИЙ")
print("=" * 80)

# 1. Проверка статуса миграций
print("\n1. Проверка статуса миграций todo:")
result = subprocess.run(
    [sys.executable, 'manage.py', 'showmigrations', 'todo'],
    capture_output=True,
    text=True
)
print(result.stdout)
if result.stderr:
    print("ОШИБКИ:", result.stderr)

# 2. Применение миграций
print("\n2. Применение миграций:")
result = subprocess.run(
    [sys.executable, 'manage.py', 'migrate', 'todo'],
    capture_output=True,
    text=True
)
print(result.stdout)
if result.stderr:
    print("ОШИБКИ:", result.stderr)

# 3. Проверка статуса после применения
print("\n3. Проверка статуса после применения:")
result = subprocess.run(
    [sys.executable, 'manage.py', 'showmigrations', 'todo'],
    capture_output=True,
    text=True
)
print(result.stdout)
if result.stderr:
    print("ОШИБКИ:", result.stderr)

print("\n" + "=" * 80)
print("ЗАВЕРШЕНО")
print("=" * 80)
