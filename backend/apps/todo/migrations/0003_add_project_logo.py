# Generated for project logo/avatar

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0002_workitem_source_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='logo',
            field=models.ImageField(blank=True, null=True, upload_to='projects/logos/', verbose_name='Logo'),
        ),
    ]
