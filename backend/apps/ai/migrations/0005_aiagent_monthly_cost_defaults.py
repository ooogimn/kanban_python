# Set default monthly_cost: 0 for free, 500 for paid agents

from decimal import Decimal
from django.db import migrations


def set_default_costs(apps, schema_editor):
    AiAgent = apps.get_model('ai', 'AiAgent')
    for agent in AiAgent.objects.all():
        if agent.is_free:
            agent.monthly_cost = Decimal('0')
        elif agent.monthly_cost is None or agent.monthly_cost == 0:
            agent.monthly_cost = Decimal('500')
        agent.save(update_fields=['monthly_cost'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('ai', '0004_aiagent_monthly_cost'),
    ]

    operations = [
        migrations.RunPython(set_default_costs, noop),
    ]
