# Add monthly_cost to AiAgent for accounting comparison

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ai', '0003_five_agents_with_avatars'),
    ]

    operations = [
        migrations.AddField(
            model_name='aiagent',
            name='monthly_cost',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                default=0,
                help_text='Учётная стоимость агента в месяц для сравнения с людьми',
                max_digits=12,
                null=True,
                verbose_name='Monthly cost (accounting)',
            ),
        ),
    ]
