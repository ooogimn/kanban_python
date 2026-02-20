#!/usr/bin/env python
"""Скрипт для проверки и исправления проблемы с миграциями."""
import os
import sys
import django
from pathlib import Path

# Добавляем backend в путь
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_path))

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

try:
    django.setup()
    print("✓ Django успешно инициализирован")
except Exception as e:
    print(f"✗ Ошибка инициализации Django: {e}")
    sys.exit(1)

from django.core.management import call_command
from django.db import connection
from io import StringIO

print("\n" + "=" * 80)
print("ДИАГНОСТИКА И ИСПРАВЛЕНИЕ ПРОБЛЕМЫ")
print("=" * 80)

# 1. Проверка подключения к БД
print("\n1. Проверка подключения к базе данных:")
try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        print(f"   ✓ Подключение к PostgreSQL успешно")
        print(f"   Версия: {version[:50]}...")
except Exception as e:
    print(f"   ✗ Ошибка подключения: {e}")
    sys.exit(1)

# 2. Проверка существования таблицы projects
print("\n2. Проверка таблицы projects:")
try:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'projects'
            )
        """)
        exists = cursor.fetchone()[0]
        if exists:
            print("   ✓ Таблица projects существует")
            
            # Проверка поля logo
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'projects' 
                AND column_name = 'logo'
            """)
            logo_field = cursor.fetchone()
            if logo_field:
                print("   ✓ Поле logo существует в таблице")
            else:
                print("   ✗ Поле logo НЕ существует в таблице")
        else:
            print("   ✗ Таблица projects НЕ существует")
except Exception as e:
    print(f"   ✗ Ошибка проверки: {e}")

# 3. Проверка статуса миграций
print("\n3. Проверка статуса миграций todo:")
try:
    out = StringIO()
    call_command('showmigrations', 'todo', stdout=out)
    migrations_status = out.getvalue()
    print(migrations_status)
    
    # Проверка, применена ли миграция 0003
    if '[X] 0003_add_project_logo' in migrations_status:
        print("   ✓ Миграция 0003_add_project_logo ПРИМЕНЕНА")
    elif '[ ] 0003_add_project_logo' in migrations_status:
        print("   ✗ Миграция 0003_add_project_logo НЕ ПРИМЕНЕНА")
    else:
        print("   ? Статус миграции 0003_add_project_logo неизвестен")
except Exception as e:
    print(f"   ✗ Ошибка проверки миграций: {e}")

# 4. Применение миграций
print("\n4. Применение миграций:")
try:
    out = StringIO()
    call_command('migrate', 'todo', stdout=out)
    result = out.getvalue()
    print(result)
    if 'No migrations to apply' in result:
        print("   ✓ Все миграции уже применены")
    elif 'Applying' in result:
        print("   ✓ Миграции успешно применены")
    else:
        print("   ? Неожиданный результат")
except Exception as e:
    print(f"   ✗ Ошибка применения миграций: {e}")

# 5. Повторная проверка поля logo
print("\n5. Повторная проверка поля logo:")
try:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'projects' 
            AND column_name = 'logo'
        """)
        logo_field = cursor.fetchone()
        if logo_field:
            print(f"   ✓ Поле logo: {logo_field[1]}, nullable: {logo_field[2]}")
        else:
            print("   ✗ Поле logo всё ещё отсутствует")
except Exception as e:
    print(f"   ✗ Ошибка проверки: {e}")

# 6. Проверка данных
print("\n6. Проверка данных в БД:")
try:
    from apps.core.models import User, Workspace
    from apps.todo.models import Project
    from apps.kanban.models import Board
    
    users_count = User.objects.count()
    workspaces_count = Workspace.objects.count()
    projects_count = Project.objects.count()
    boards_count = Board.objects.count()
    
    print(f"   Пользователи: {users_count}")
    print(f"   Рабочие пространства: {workspaces_count}")
    print(f"   Проекты: {projects_count}")
    print(f"   Канбан-доски: {boards_count}")
    
    if users_count > 0:
        print("\n   Пользователи:")
        for user in User.objects.all()[:5]:
            print(f"     - {user.username} (avatar: {'есть' if user.avatar else 'нет'})")
    
    if workspaces_count > 0:
        print("\n   Рабочие пространства:")
        for ws in Workspace.objects.all()[:5]:
            print(f"     - {ws.name} (slug: {ws.slug})")
    
    if projects_count > 0:
        print("\n   Проекты:")
        for proj in Project.objects.all()[:5]:
            print(f"     - {proj.name} (workspace: {proj.workspace.name if proj.workspace else 'нет'})")
    
    if boards_count > 0:
        print("\n   Канбан-доски:")
        for board in Board.objects.all()[:5]:
            print(f"     - {board.name} (project: {board.project.name if board.project else 'нет'})")
    
except Exception as e:
    print(f"   ✗ Ошибка проверки данных: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("ДИАГНОСТИКА ЗАВЕРШЕНА")
print("=" * 80)
