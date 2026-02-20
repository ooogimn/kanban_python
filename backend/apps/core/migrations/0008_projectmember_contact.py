# HR integration: ProjectMember.contact (nullable, переходный период)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_workspace_progress_health'),
        ('hr', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='projectmember',
            name='contact',
            field=models.ForeignKey(
                blank=True,
                help_text='Ссылка на HR-контакт (опционально в переходный период)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='project_members',
                to='hr.contact',
                verbose_name='Contact',
            ),
        ),
    ]
