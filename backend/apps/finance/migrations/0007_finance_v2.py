from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0006_add_payroll_contact_to_transaction"),
        ("core", "0001_initial"),
        ("crm", "0001_initial"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="Wallet",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                (
                    "type",
                    models.CharField(
                        choices=[
                            ("bank", "Bank Account / Card"),
                            ("cash", "Cash"),
                            ("crypto", "Crypto Wallet"),
                            ("ewallet", "E-Wallet"),
                        ],
                        default="bank",
                        max_length=20,
                    ),
                ),
                ("currency", models.CharField(default="RUB", max_length=3)),
                (
                    "balance",
                    models.DecimalField(decimal_places=2, default=0, max_digits=19),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("last_reconciled_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="wallets",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="wallets",
                        to="core.workspace",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["owner"], name="finance_wallet_owner_idx"),
                    models.Index(fields=["workspace"], name="finance_wallet_workspace_idx"),
                    models.Index(fields=["is_active"], name="finance_wallet_active_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Category",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=120)),
                (
                    "type",
                    models.CharField(
                        choices=[("income", "Income"), ("expense", "Expense")],
                        max_length=10,
                    ),
                ),
                (
                    "pnl_group",
                    models.CharField(
                        choices=[
                            ("revenue", "Revenue"),
                            ("cogs", "COGS"),
                            ("opex", "OPEX"),
                            ("tax", "Tax"),
                            ("other", "Other"),
                            ("dividends", "Dividends"),
                            ("salary", "Salary / Payroll"),
                        ],
                        default="other",
                        max_length=20,
                    ),
                ),
                ("color", models.CharField(default="#cccccc", max_length=7)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="children",
                        to="finance.category",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="finance_categories",
                        to="core.workspace",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["workspace", "type"],
                        name="finance_category_ws_type_idx",
                    ),
                ],
                "unique_together": {("workspace", "name")},
            },
        ),
        migrations.CreateModel(
            name="BankConnection",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                (
                    "bank_type",
                    models.CharField(
                        choices=[
                            ("sber", "Sberbank"),
                            ("tinkoff", "Tinkoff"),
                            ("tochka", "Tochka"),
                            ("manual_csv", "Manual CSV"),
                            ("other", "Other"),
                        ],
                        default="manual_csv",
                        max_length=20,
                    ),
                ),
                ("api_token", models.CharField(blank=True, max_length=512)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "linked_wallet",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="bank_connection",
                        to="finance.wallet",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bank_connections",
                        to="core.workspace",
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="transaction",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="transactions",
                to="finance.category",
            ),
        ),
        migrations.AddField(
            model_name="transaction",
            name="counterparty",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="transactions",
                to="crm.customer",
            ),
        ),
        migrations.AddField(
            model_name="transaction",
            name="currency",
            field=models.CharField(default="RUB", max_length=3),
        ),
        migrations.AddField(
            model_name="transaction",
            name="destination_wallet",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="transactions_to",
                to="finance.wallet",
            ),
        ),
        migrations.AddField(
            model_name="transaction",
            name="evidence_content_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="contenttypes.contenttype",
            ),
        ),
        migrations.AddField(
            model_name="transaction",
            name="evidence_object_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="receipt",
            field=models.FileField(
                blank=True, null=True, upload_to="protected/receipts/%Y/%m/"
            ),
        ),
        migrations.AddField(
            model_name="transaction",
            name="source_wallet",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="transactions_from",
                to="finance.wallet",
            ),
        ),
        migrations.AddField(
            model_name="transaction",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="completed",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="transaction",
            name="transfer_group_id",
            field=models.UUIDField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="workspace",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="transactions",
                to="core.workspace",
            ),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="amount",
            field=models.DecimalField(decimal_places=2, max_digits=19),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="project",
            field=models.ForeignKey(
                blank=True,
                help_text="Проект (общий бюджет)",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="transactions",
                to="todo.project",
                verbose_name="Project",
            ),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["source_wallet"], name="finance_tx_source_wallet_idx"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["destination_wallet"], name="finance_tx_dest_wallet_idx"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["transfer_group_id"], name="finance_tx_transfer_group_idx"),
        ),
    ]
