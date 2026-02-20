#!/usr/bin/env python
"""
Скрипт удаления задачи "ewewe" в проекте "КАНБАН ДОСКА".
Запуск из папки backend: python delete_task_ewewe.py
(или: python manage.py shell < delete_task_ewewe.py — не подходит, нужен django setup)

Лучше: python manage.py shell
Затем вставить код ниже.
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.todo.models import Project, WorkItem
from django.utils import timezone

# Ищем проект по имени
proj = Project.objects.filter(name__icontains='КАНБАН').first()
if not proj:
    proj = Project.objects.filter(name__icontains='ДОСКА').first()
if not proj:
    print('Проект не найден')
    sys.exit(1)
print('Проект:', proj.name, 'id=', proj.id)

# Ищем задачу ewewe
wi = WorkItem.objects.filter(project=proj, title='ewewe', deleted_at__isnull=True).first()
if not wi:
    wi = WorkItem.objects.filter(project=proj, title__icontains='ewewe', deleted_at__isnull=True).first()
if not wi:
    print('Задача ewewe не найдена в проекте')
    sys.exit(1)
print('Задача:', wi.title, 'id=', wi.id)

# Мягкое удаление
wi.deleted_at = timezone.now()
wi._skip_signal = True
wi.save(update_fields=['deleted_at', 'updated_at'])
print('Задача успешно удалена (soft delete).')
