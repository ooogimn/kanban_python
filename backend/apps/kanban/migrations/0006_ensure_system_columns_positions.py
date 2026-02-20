# Data migration: на каждой доске (Stage) три обязательные колонки с позициями 1000, 5000, 9000.
# Создаём недостающие, переставляем существующие системные колонки.

from django.db import migrations

# Позиции системных колонок (между ними можно вставлять пользовательские)
POS_PLAN = 1000
POS_IN_PROGRESS = 5000
POS_DONE = 9000


def ensure_system_columns(apps, schema_editor):
    Stage = apps.get_model('kanban', 'Stage')
    Column = apps.get_model('kanban', 'Column')

    for stage in Stage.objects.all():
        columns = list(Column.objects.filter(stage=stage).order_by('position'))
        plan = next((c for c in columns if c.system_type == 'plan'), None)
        in_progress = next((c for c in columns if c.system_type == 'in_progress'), None)
        done = next((c for c in columns if c.system_type == 'done'), None)

        # Создаём недостающие системные колонки; у существующих выставляем позиции 1000, 5000, 9000
        if not plan:
            Column.objects.create(
                name='Планируется',
                column_type='todo',
                system_type='plan',
                stage=stage,
                position=POS_PLAN,
                color='#3b82f6',
            )
        elif plan.position != POS_PLAN:
            plan.position = POS_PLAN
            plan.save(update_fields=['position'])

        if not in_progress:
            Column.objects.create(
                name='В работе',
                column_type='in_progress',
                system_type='in_progress',
                stage=stage,
                position=POS_IN_PROGRESS,
                color='#f59e0b',
            )
        elif in_progress.position != POS_IN_PROGRESS:
            in_progress.position = POS_IN_PROGRESS
            in_progress.save(update_fields=['position'])

        if not done:
            Column.objects.create(
                name='Завершено',
                column_type='completed',
                system_type='done',
                stage=stage,
                position=POS_DONE,
                color='#10b981',
            )
        elif done.position != POS_DONE:
            done.position = POS_DONE
            done.save(update_fields=['position'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('kanban', '0005_column_color'),
    ]

    operations = [
        migrations.RunPython(ensure_system_columns, noop_reverse),
    ]
