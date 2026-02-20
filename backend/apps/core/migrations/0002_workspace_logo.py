# Generated for workspace logo

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='workspace',
            name='logo',
            field=models.ImageField(blank=True, null=True, upload_to='workspaces/logos/', verbose_name='Logo'),
        ),
    ]
