# Generated for Task 2.1 — связь Project -> Customer

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0008_add_alert_fields'),
        ('crm', '0003_add_customer_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='customer',
            field=models.ForeignKey(
                blank=True,
                help_text='Клиент проекта (CRM)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='projects',
                to='crm.customer',
                verbose_name='Customer',
            ),
        ),
    ]
