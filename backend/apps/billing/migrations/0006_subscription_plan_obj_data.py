# Data migration: create default Plans and link Subscription.plan_obj

from decimal import Decimal
from django.db import migrations


def default_limits():
    return {
        'max_system_contacts': 10,
        'max_ai_agents': 1,
        'features': {'hr': True, 'payroll': False, 'ai_analyst': False},
    }


def pro_limits():
    return {
        'max_system_contacts': 100,
        'max_ai_agents': 5,
        'features': {'hr': True, 'payroll': True, 'ai_analyst': True},
    }


def create_plans_and_link(apps, schema_editor):
    Plan = apps.get_model('saas', 'Plan')
    Subscription = apps.get_model('billing', 'Subscription')

    plan_free, _ = Plan.objects.get_or_create(
        name='Free',
        defaults={
            'price': Decimal('0'),
            'currency': 'RUB',
            'limits': default_limits(),
            'is_active': True,
            'is_default': True,
        },
    )
    plan_pro, _ = Plan.objects.get_or_create(
        name='Pro',
        defaults={
            'price': Decimal('2990'),
            'currency': 'RUB',
            'limits': pro_limits(),
            'is_active': True,
            'is_default': False,
        },
    )
    plan_enterprise, _ = Plan.objects.get_or_create(
        name='Enterprise',
        defaults={
            'price': Decimal('0'),
            'currency': 'RUB',
            'limits': {
                'max_system_contacts': 0,
                'max_ai_agents': 0,
                'features': {'hr': True, 'payroll': True, 'ai_analyst': True},
            },
            'is_active': True,
            'is_default': False,
        },
    )

    plan_by_legacy = {
        'free': plan_free,
        'pro': plan_pro,
        'enterprise': plan_enterprise,
    }

    for sub in Subscription.objects.all():
        plan = plan_by_legacy.get(sub.plan) or plan_free
        sub.plan_obj = plan
        sub.save(update_fields=['plan_obj'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0005_add_plan_obj_to_subscription'),
    ]

    operations = [
        migrations.RunPython(create_plans_and_link, noop),
    ]
