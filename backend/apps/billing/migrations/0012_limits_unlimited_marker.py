from django.db import migrations


LIMIT_KEYS = (
    'max_system_contacts',
    'max_ai_agents',
    'max_users',
    'max_projects',
    'storage_gb',
)


def forward_convert_zero_to_minus_one(apps, schema_editor):
    PlanVersion = apps.get_model('billing', 'PlanVersion')
    for version in PlanVersion.objects.all().iterator():
        limits = version.limits_schema if isinstance(version.limits_schema, dict) else {}
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
            version.limits_schema = limits
            version.save(update_fields=['limits_schema', 'updated_at'])


def backward_convert_minus_one_to_zero(apps, schema_editor):
    PlanVersion = apps.get_model('billing', 'PlanVersion')
    for version in PlanVersion.objects.all().iterator():
        limits = version.limits_schema if isinstance(version.limits_schema, dict) else {}
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
            version.limits_schema = limits
            version.save(update_fields=['limits_schema', 'updated_at'])


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0011_rename_billing_acco_status_18f881_idx_billing_acc_status_2d1635_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(forward_convert_zero_to_minus_one, backward_convert_minus_one_to_zero),
    ]
