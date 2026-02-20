# Freemium: личное пространство (is_personal, owner), не учитывается в лимитах

from django.db import migrations, models
from django.db.models import Q
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_user_is_onboarded'),
    ]

    operations = [
        migrations.AddField(
            model_name='workspace',
            name='owner',
            field=models.ForeignKey(
                blank=True,
                help_text='Владелец; для личного пространства обязателен',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='owned_workspaces',
                to='core.user',
                verbose_name='Owner',
            ),
        ),
        migrations.AddField(
            model_name='workspace',
            name='is_personal',
            field=models.BooleanField(
                default=False,
                editable=False,
                help_text='Личное пространство пользователя; не учитывается в лимитах платных пространств',
                verbose_name='Is personal workspace',
            ),
        ),
        migrations.AddConstraint(
            model_name='workspace',
            constraint=models.UniqueConstraint(
                condition=Q(is_personal=True),
                fields=('owner',),
                name='unique_personal_workspace',
            ),
        ),
    ]
