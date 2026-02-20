# Создать подписку (free) для существующих пользователей

from django.conf import settings
from django.db import migrations


def create_subscriptions(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split('.')
    User = apps.get_model(app_label, model_name)
    Subscription = apps.get_model('billing', 'Subscription')
    for user in User.objects.all():
        if not Subscription.objects.filter(user=user).exists():
            Subscription.objects.create(
                user=user,
                plan='free',
                is_active=True,
                max_system_contacts=0,
            )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0003_subscription'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(create_subscriptions, noop),
    ]
