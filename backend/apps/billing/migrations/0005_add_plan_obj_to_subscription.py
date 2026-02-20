# Add plan_obj FK to Subscription (saas.Plan)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0004_subscription_for_existing_users'),
        ('saas', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscription',
            name='plan_obj',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='subscriptions',
                to='saas.plan',
                verbose_name='Plan (FK)',
            ),
        ),
    ]
