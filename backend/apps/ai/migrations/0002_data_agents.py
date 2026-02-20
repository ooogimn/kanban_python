# Data migration: 3 base agents (SaaS Sprint 3)

from django.db import migrations


def create_agents(apps, schema_editor):
    AiAgent = apps.get_model('ai', 'AiAgent')
    AiAgent.objects.get_or_create(
        role='assistant',
        defaults={
            'name': 'General Assistant',
            'description': 'Универсальный помощник для общих вопросов и задач.',
            'system_prompt': 'You are a helpful general assistant.',
            'avatar_url': '',
            'is_active': True,
            'is_free': True,
        },
    )
    AiAgent.objects.get_or_create(
        role='hr',
        defaults={
            'name': 'HR Manager',
            'description': 'Помощник по кадрам: приглашения, контакты, ведомости.',
            'system_prompt': 'You are an HR manager assistant. Help with staff, contacts, payroll questions.',
            'avatar_url': '',
            'is_active': True,
            'is_free': False,
        },
    )
    AiAgent.objects.get_or_create(
        role='finance',
        defaults={
            'name': 'Financial Analyst',
            'description': 'Анализ бюджета, расходов и отчётов по проектам.',
            'system_prompt': 'You are a financial analyst assistant. Help with budget, expenses, reports.',
            'avatar_url': '',
            'is_active': True,
            'is_free': False,
        },
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('ai', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_agents, noop),
    ]
