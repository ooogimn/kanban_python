# Slug может быть пустым при создании (заполняется автоматически из заголовка)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0002_post_video_main_media_autoplay'),
    ]

    operations = [
        migrations.AlterField(
            model_name='post',
            name='slug',
            field=models.SlugField(
                blank=True,
                help_text='URL-friendly identifier',
                max_length=255,
                unique=True,
                verbose_name='Slug',
            ),
        ),
    ]
