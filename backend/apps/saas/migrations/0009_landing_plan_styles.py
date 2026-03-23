from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('saas', '0008_landing_portal_cards'),
    ]

    operations = [
        migrations.AddField(
            model_name='saasplatformsettings',
            name='landing_plan_styles',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
