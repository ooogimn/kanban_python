from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('saas', '0010_settings_history'),
    ]

    operations = [
        migrations.AddField(
            model_name='saasplatformsettings',
            name='landing_ai_canned_responses',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='saasplatformsettings',
            name='landing_ai_fallback_reply',
            field=models.TextField(blank=True, default='Напишите подробнее, и мы скоро подключим расширенный ИИ-ответ.'),
        ),
    ]
