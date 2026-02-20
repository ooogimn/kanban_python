# Generated for Task 4.2 — RBAC (Role-Based Access Control)

from django.db import migrations


def create_rbac_groups(apps, schema_editor):
    """Создание групп пользователей: Director, Manager, Employee."""
    Group = apps.get_model('auth', 'Group')
    for name in ['Director', 'Manager', 'Employee']:
        Group.objects.get_or_create(name=name)


def reverse_create_rbac_groups(apps, schema_editor):
    """Удаление групп при откате миграции."""
    Group = apps.get_model('auth', 'Group')
    Group.objects.filter(name__in=['Director', 'Manager', 'Employee']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_verificationcode'),
    ]

    operations = [
        migrations.RunPython(create_rbac_groups, reverse_create_rbac_groups),
    ]
