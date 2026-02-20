#!/usr/bin/env python
"""Скрипт для проверки данных в БД с выводом в файл."""
import os
import sys
import django

# Добавляем backend в путь
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.core.models import User, Workspace, WorkspaceMember
from apps.todo.models import Project, WorkItem
from apps.kanban.models import Board, Column, Card
from django.db import connection

output_file = 'db_check_result.txt'

with open(output_file, 'w', encoding='utf-8') as f:
    f.write("=" * 80 + "\n")
    f.write("ПРОВЕРКА БАЗЫ ДАННЫХ\n")
    f.write("=" * 80 + "\n")

    # Проверка таблиц
    f.write("\n1. ТАБЛИЦЫ В БД:\n")
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        tables = cursor.fetchall()
        for table in tables:
            f.write(f"   - {table[0]}\n")

    # Проверка пользователей
    f.write("\n2. ПОЛЬЗОВАТЕЛИ:\n")
    users = User.objects.all()
    f.write(f"   Всего: {users.count()}\n")
    for user in users:
        f.write(f"   - {user.username} (ID: {user.id}, email: {user.email})\n")
        f.write(f"     Avatar: {user.avatar if user.avatar else 'нет'}\n")
        f.write(f"     First name: {user.first_name}, Last name: {user.last_name}\n")

    # Проверка рабочих пространств
    f.write("\n3. РАБОЧИЕ ПРОСТРАНСТВА:\n")
    workspaces = Workspace.objects.all()
    f.write(f"   Всего: {workspaces.count()}\n")
    for ws in workspaces:
        f.write(f"   - {ws.name} (ID: {ws.id}, slug: {ws.slug})\n")
        members = WorkspaceMember.objects.filter(workspace=ws)
        f.write(f"     Участники: {members.count()}\n")
        for member in members:
            f.write(f"       * {member.user.username} ({member.role})\n")

    # Проверка проектов
    f.write("\n4. ПРОЕКТЫ:\n")
    projects = Project.objects.all()
    f.write(f"   Всего: {projects.count()}\n")
    for proj in projects:
        f.write(f"   - {proj.name} (ID: {proj.id})\n")
        f.write(f"     Workspace: {proj.workspace.name if proj.workspace else 'нет'}\n")
        f.write(f"     Owner: {proj.owner.username if proj.owner else 'нет'}\n")
        f.write(f"     Logo: {proj.logo if proj.logo else 'нет'}\n")
        f.write(f"     Status: {proj.status}\n")

    # Проверка задач
    f.write("\n5. ЗАДАЧИ:\n")
    tasks = WorkItem.objects.all()
    f.write(f"   Всего: {tasks.count()}\n")
    for task in tasks[:10]:  # Первые 10
        f.write(f"   - {task.title} (ID: {task.id})\n")
        f.write(f"     Project: {task.project.name if task.project else 'нет'}\n")
        f.write(f"     Status: {task.status}\n")

    # Проверка канбан-досок
    f.write("\n6. КАНБАН-ДОСКИ:\n")
    boards = Board.objects.all()
    f.write(f"   Всего: {boards.count()}\n")
    for board in boards:
        f.write(f"   - {board.name} (ID: {board.id})\n")
        f.write(f"     Project: {board.project.name if board.project else 'нет'}\n")
        columns = Column.objects.filter(board=board)
        f.write(f"     Колонки: {columns.count()}\n")
        cards = Card.objects.filter(column__board=board)
        f.write(f"     Карточки: {cards.count()}\n")

    # Проверка структуры таблицы projects
    f.write("\n7. СТРУКТУРА ТАБЛИЦЫ projects:\n")
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'projects'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        for col in columns:
            f.write(f"   - {col[0]}: {col[1]} (nullable: {col[2]})\n")

    # Проверка миграций
    f.write("\n8. ПРИМЕНЕННЫЕ МИГРАЦИИ (todo app):\n")
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT app, name, applied
            FROM django_migrations
            WHERE app = 'todo'
            ORDER BY applied
        """)
        migrations = cursor.fetchall()
        for mig in migrations:
            f.write(f"   - {mig[1]} (applied: {mig[2]})\n")

    f.write("\n" + "=" * 80 + "\n")
    f.write("ПРОВЕРКА ЗАВЕРШЕНА\n")
    f.write("=" * 80 + "\n")

print(f"Результаты сохранены в {output_file}")
