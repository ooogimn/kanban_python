#!/usr/bin/env python
"""Скрипт для проверки данных в БД."""
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

print("=" * 80)
print("ПРОВЕРКА БАЗЫ ДАННЫХ")
print("=" * 80)

# Проверка таблиц
print("\n1. ТАБЛИЦЫ В БД:")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    """)
    tables = cursor.fetchall()
    for table in tables:
        print(f"   - {table[0]}")

# Проверка пользователей
print("\n2. ПОЛЬЗОВАТЕЛИ:")
users = User.objects.all()
print(f"   Всего: {users.count()}")
for user in users:
    print(f"   - {user.username} (ID: {user.id}, email: {user.email})")
    print(f"     Avatar: {user.avatar if user.avatar else 'нет'}")
    print(f"     First name: {user.first_name}, Last name: {user.last_name}")

# Проверка рабочих пространств
print("\n3. РАБОЧИЕ ПРОСТРАНСТВА:")
workspaces = Workspace.objects.all()
print(f"   Всего: {workspaces.count()}")
for ws in workspaces:
    print(f"   - {ws.name} (ID: {ws.id}, slug: {ws.slug})")
    members = WorkspaceMember.objects.filter(workspace=ws)
    print(f"     Участники: {members.count()}")
    for member in members:
        print(f"       * {member.user.username} ({member.role})")

# Проверка проектов
print("\n4. ПРОЕКТЫ:")
projects = Project.objects.all()
print(f"   Всего: {projects.count()}")
for proj in projects:
    print(f"   - {proj.name} (ID: {proj.id})")
    print(f"     Workspace: {proj.workspace.name if proj.workspace else 'нет'}")
    print(f"     Owner: {proj.owner.username if proj.owner else 'нет'}")
    print(f"     Logo: {proj.logo if proj.logo else 'нет'}")
    print(f"     Status: {proj.status}")

# Проверка задач
print("\n5. ЗАДАЧИ:")
tasks = WorkItem.objects.all()
print(f"   Всего: {tasks.count()}")
for task in tasks[:10]:  # Первые 10
    print(f"   - {task.title} (ID: {task.id})")
    print(f"     Project: {task.project.name if task.project else 'нет'}")
    print(f"     Status: {task.status}")

# Проверка канбан-досок
print("\n6. КАНБАН-ДОСКИ:")
boards = Board.objects.all()
print(f"   Всего: {boards.count()}")
for board in boards:
    print(f"   - {board.name} (ID: {board.id})")
    print(f"     Project: {board.project.name if board.project else 'нет'}")
    columns = Column.objects.filter(board=board)
    print(f"     Колонки: {columns.count()}")
    cards = Card.objects.filter(column__board=board)
    print(f"     Карточки: {cards.count()}")

# Проверка структуры таблицы projects
print("\n7. СТРУКТУРА ТАБЛИЦЫ projects:")
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'projects'
        ORDER BY ordinal_position
    """)
    columns = cursor.fetchall()
    for col in columns:
        print(f"   - {col[0]}: {col[1]} (nullable: {col[2]})")

print("\n" + "=" * 80)
print("ПРОВЕРКА ЗАВЕРШЕНА")
print("=" * 80)
