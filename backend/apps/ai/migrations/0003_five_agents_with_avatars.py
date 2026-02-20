# Data migration: 5 ИИ-сотрудников с аватарками

from django.db import migrations


def set_five_agents(apps, schema_editor):
    AiAgent = apps.get_model('ai', 'AiAgent')

    # 1. ИИ-Помощник (General Assistant) — avatar AI-Pomosnic
    a = AiAgent.objects.filter(role='assistant').first()
    if a:
        a.name = 'ИИ-Помощник'
        a.avatar_url = '/AI-Pomosnic.png'
        a.save(update_fields=['name', 'avatar_url'])

    # 2. ИИ-HR — avatar AI-HR
    a = AiAgent.objects.filter(role='hr').first()
    if a:
        a.name = 'ИИ-HR'
        a.avatar_url = '/AI-HR.png'
        a.save(update_fields=['name', 'avatar_url'])

    # 3. ИИ-Бухгалтер (Financial Analyst) — avatar AI-Finance
    a = AiAgent.objects.filter(role='finance').first()
    if a:
        a.name = 'ИИ-Бухгалтер'
        a.avatar_url = '/AI-Finance.png'
        a.save(update_fields=['name', 'avatar_url'])

    # 4. ИИ-Менеджер (новый)
    AiAgent.objects.get_or_create(
        role='manager',
        defaults={
            'name': 'ИИ-Менеджер',
            'description': 'Помощник руководителя: планы, задачи, контроль исполнения.',
            'system_prompt': 'You are an AI manager assistant. Help with planning, tasks, and execution control.',
            'avatar_url': '/AI-Manager.png',
            'is_active': True,
            'is_free': False,
        },
    )

    # 5. ИИ-Аналитик (новый)
    AiAgent.objects.get_or_create(
        role='analyst',
        defaults={
            'name': 'ИИ-Аналитик',
            'description': 'Анализ данных, отчёты, графики и рекомендации.',
            'system_prompt': 'You are an AI analyst. Help with data analysis, reports, and insights.',
            'avatar_url': '/AI-Analitik.png',
            'is_active': True,
            'is_free': False,
        },
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('ai', '0002_data_agents'),
    ]

    operations = [
        migrations.RunPython(set_five_agents, noop),
    ]
