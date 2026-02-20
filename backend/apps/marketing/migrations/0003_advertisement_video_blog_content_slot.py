# Advertisement: video field + slot blog_content (choice only, no DB change for slot)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0002_advertisement_width_height'),
    ]

    operations = [
        migrations.AddField(
            model_name='advertisement',
            name='video',
            field=models.FileField(
                blank=True,
                help_text='Используется при content_type=video',
                null=True,
                upload_to='ads/%Y/%m/',
                verbose_name='Video',
            ),
        ),
    ]
