# Data migration: строгая изоляция спринтов.
# Проставляем stage_id из kanban_column.stage_id где колонка задана;
# где kanban_column пуст — оставляем stage_id=None (бэклог).

from django.db import migrations


def backfill_stage_from_column(apps, schema_editor):
    WorkItem = apps.get_model('todo', 'WorkItem')
    updated = 0
    for wi in WorkItem.objects.filter(deleted_at__isnull=True).select_related('kanban_column'):
        if wi.kanban_column_id and wi.stage_id != wi.kanban_column.stage_id:
            wi.stage_id = wi.kanban_column.stage_id
            wi.save(update_fields=['stage_id'])
            updated += 1
    # Оставляем stage_id=None где kanban_column=None (бэклог) — ничего не делаем


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0019_workitem_started_at'),
    ]

    operations = [
        migrations.RunPython(backfill_stage_from_column, noop_reverse),
    ]
