# Data migration: переименование колонки «Планируется» в «В плане» для единообразия.

from django.db import migrations


def rename_plan_column_label(apps, schema_editor):
    Column = apps.get_model('kanban', 'Column')
    Column.objects.filter(system_type='plan', name='Планируется').update(name='В плане')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('kanban', '0006_ensure_system_columns_positions'),
    ]

    operations = [
        migrations.RunPython(rename_plan_column_label, noop_reverse),
    ]
