# Личный проект: is_personal, один такой на workspace

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0017_rename_checklist_i_workite_idx_checklist_i_workite_0d7efb_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='is_personal',
            field=models.BooleanField(
                default=False,
                editable=False,
                help_text='Личный проект пользователя в личном пространстве; создаётся автоматически',
                verbose_name='Is personal project',
            ),
        ),
        migrations.AddConstraint(
            model_name='project',
            constraint=models.UniqueConstraint(
                condition=Q(is_personal=True),
                fields=('workspace',),
                name='unique_personal_project_per_workspace',
            ),
        ),
    ]
