from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('saas', '0007_landing_default_version'),
    ]

    operations = [
        migrations.AddField(
            model_name='saasplatformsettings',
            name='landing_portal_cards',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
