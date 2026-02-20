# Public Sprint: onboarding flag for first-time director

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_rename_project_mem_project_6a8c2a_idx_project_mem_project_e547cf_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_onboarded',
            field=models.BooleanField(
                default=False,
                help_text='Прошёл ли пользователь онбординг (workspace + первый ИИ)',
                verbose_name='Onboarding completed',
            ),
        ),
    ]
