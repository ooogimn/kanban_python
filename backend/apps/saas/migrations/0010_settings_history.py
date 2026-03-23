from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('saas', '0009_landing_plan_styles'),
    ]

    operations = [
        migrations.AddField(
            model_name='saasplatformsettings',
            name='settings_history',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
