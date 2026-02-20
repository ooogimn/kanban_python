# HR-SPRINT 5: связь Transaction -> Contact для истории выплат

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0005_remove_transaction_transaction_project_299495_idx_and_more"),
        ("hr", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="payroll_contact",
            field=models.ForeignKey(
                blank=True,
                help_text="Контакт HR при выплате зарплаты (SPEND)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="payroll_transactions",
                to="hr.contact",
                verbose_name="Payroll Contact",
            ),
        ),
    ]
