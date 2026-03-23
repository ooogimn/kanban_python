from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('saas', '0011_landing_ai_canned_replies'),
    ]

    operations = [
        migrations.AddField(
            model_name='saasplatformsettings',
            name='landing_ai_chat_logs',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
