# WorkItem.color для Imperial Illumination (цвет карточки задачи)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0013_project_progress_health'),
    ]

    operations = [
        migrations.AddField(
            model_name='workitem',
            name='color',
            field=models.CharField(
                blank=True,
                help_text='Hex color for task card (Imperial Illumination)',
                max_length=7,
                null=True,
                verbose_name='Color',
            ),
        ),
    ]
