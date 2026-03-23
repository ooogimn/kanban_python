from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('saas', '0003_saasplatformsettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='saasplatformsettings',
            name='landing_media_categories',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='saasplatformsettings',
            name='landing_media_carousel',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
