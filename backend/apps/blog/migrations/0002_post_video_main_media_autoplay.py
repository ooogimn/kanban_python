# Add video and main_media_autoplay to Post

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='video',
            field=models.FileField(
                blank=True,
                help_text='Главное видео поста (если задано, может отображаться вместо изображения)',
                null=True,
                upload_to='blog/%Y/%m/',
                verbose_name='Video',
            ),
        ),
        migrations.AddField(
            model_name='post',
            name='main_media_autoplay',
            field=models.BooleanField(
                default=True,
                help_text='Автовоспроизведение для главного видео',
                verbose_name='Autoplay main media',
            ),
        ),
    ]
