# Generated for User role/company and Workspace companies

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0001_initial'),
        ('core', '0002_workspace_logo'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='role',
            field=models.CharField(
                blank=True,
                choices=[('admin', 'Admin'), ('member', 'Member'), ('guest', 'Guest')],
                default='member',
                help_text='Глобальная роль пользователя в системе',
                max_length=20,
                verbose_name='Role'
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='company',
            field=models.ForeignKey(
                blank=True,
                help_text='Организация, в которой работает пользователь',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='employees',
                to='crm.company',
                verbose_name='Company'
            ),
        ),
        migrations.AddField(
            model_name='workspace',
            name='companies',
            field=models.ManyToManyField(
                blank=True,
                help_text='Контрагенты, работающие в этом пространстве',
                related_name='workspaces',
                to='crm.company',
                verbose_name='Companies'
            ),
        ),
    ]
