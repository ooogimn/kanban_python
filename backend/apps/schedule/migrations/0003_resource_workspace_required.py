# Migration: fill NULL workspace on Resource, then make non-nullable

import django.db.models.deletion
from django.db import migrations, models


def fill_resource_workspace(apps, schema_editor):
    """Присвоить всем Resource без workspace первое рабочее пространство."""
    Resource = apps.get_model('schedule', 'Resource')
    Workspace = apps.get_model('core', 'Workspace')
    first = Workspace.objects.order_by('pk').first()
    if first:
        Resource.objects.filter(workspace_id__isnull=True).update(workspace_id=first.pk)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('schedule', '0002_add_workspace_and_datetime_fields'),
        ('core', '0004_verificationcode'),
    ]

    operations = [
        migrations.RunPython(fill_resource_workspace, noop),
        migrations.AlterField(
            model_name='resource',
            name='workspace',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='resources',
                to='core.workspace',
                verbose_name='Workspace',
                null=False,
            ),
        ),
    ]
