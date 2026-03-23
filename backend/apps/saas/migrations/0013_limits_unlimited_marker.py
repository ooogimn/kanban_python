from django.db import migrations


LIMIT_KEYS = (
    'max_system_contacts',
    'max_ai_agents',
    'max_users',
    'max_projects',
    'storage_gb',
)


def forward_convert_zero_to_minus_one(apps, schema_editor):
    Plan = apps.get_model('saas', 'Plan')
    for plan in Plan.objects.all().iterator():
        limits = plan.limits if isinstance(plan.limits, dict) else {}
        changed = False
        for key in LIMIT_KEYS:
            if key not in limits:
                continue
            value = limits.get(key)
            try:
                num = float(value)
            except (TypeError, ValueError):
                continue
            if num == 0:
                limits[key] = -1
                changed = True
        if changed:
            plan.limits = limits
            plan.save(update_fields=['limits', 'updated_at'])


def backward_convert_minus_one_to_zero(apps, schema_editor):
    Plan = apps.get_model('saas', 'Plan')
    for plan in Plan.objects.all().iterator():
        limits = plan.limits if isinstance(plan.limits, dict) else {}
        changed = False
        for key in LIMIT_KEYS:
            if key not in limits:
                continue
            value = limits.get(key)
            try:
                num = float(value)
            except (TypeError, ValueError):
                continue
            if num == -1:
                limits[key] = 0
                changed = True
        if changed:
            plan.limits = limits
            plan.save(update_fields=['limits', 'updated_at'])


class Migration(migrations.Migration):
    dependencies = [
        ('saas', '0012_landing_ai_chat_logs'),
    ]

    operations = [
        migrations.RunPython(forward_convert_zero_to_minus_one, backward_convert_minus_one_to_zero),
    ]
