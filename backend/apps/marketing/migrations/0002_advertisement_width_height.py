# Add optional width/height for ad size

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='advertisement',
            name='width',
            field=models.PositiveSmallIntegerField(blank=True, help_text='Рекомендуемая ширина в пикселях', null=True, verbose_name='Width (px)'),
        ),
        migrations.AddField(
            model_name='advertisement',
            name='height',
            field=models.PositiveSmallIntegerField(blank=True, help_text='Рекомендуемая высота в пикселях', null=True, verbose_name='Height (px)'),
        ),
    ]
