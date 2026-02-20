# Admin Control: принудительный бизнес-тариф для пользователя

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_add_workspace_owner_is_personal'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='force_business_plan',
            field=models.BooleanField(
                default=False,
                help_text='Принудительно считать тариф бизнесом (без рекламы, все функции)',
                verbose_name='Force business plan',
            ),
        ),
    ]
