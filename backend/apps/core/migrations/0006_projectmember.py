# STEP 1.2 — ProjectMember (теневые сотрудники)

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_create_rbac_groups'),
        ('todo', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('display_name', models.CharField(help_text='Имя из user или введённое вручную для теневого', max_length=255, verbose_name='Display Name')),
                ('role', models.CharField(default='Member', help_text='Напр.: Manager, Developer', max_length=100, verbose_name='Role')),
                ('hourly_rate', models.DecimalField(decimal_places=2, default=0, help_text='Ставка для финансов/биллинга', max_digits=10, verbose_name='Hourly Rate')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='members', to='todo.project', verbose_name='Project')),
                ('user', models.ForeignKey(blank=True, help_text='Пусто — теневой сотрудник (только имя и ставка)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='project_memberships', to=settings.AUTH_USER_MODEL, verbose_name='User')),
            ],
            options={
                'verbose_name': 'Project Member',
                'verbose_name_plural': 'Project Members',
                'db_table': 'project_members',
                'ordering': ['display_name'],
            },
        ),
        migrations.AddIndex(
            model_name='projectmember',
            index=models.Index(fields=['project'], name='project_mem_project_6a8c2a_idx'),
        ),
        migrations.AddIndex(
            model_name='projectmember',
            index=models.Index(fields=['user'], name='project_mem_user_id_9f3d4b_idx'),
        ),
        migrations.AddConstraint(
            model_name='projectmember',
            constraint=models.UniqueConstraint(condition=Q(user__isnull=False), fields=('project', 'user'), name='unique_project_user_when_user_set'),
        ),
    ]
