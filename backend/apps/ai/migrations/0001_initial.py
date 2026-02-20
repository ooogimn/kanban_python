# AI Marketplace & Chat models (SaaS Sprint 3)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AiAgent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=128, verbose_name='Name')),
                ('role', models.CharField(choices=[('hr', 'HR'), ('finance', 'Finance'), ('assistant', 'Assistant')], default='assistant', max_length=32, verbose_name='Role (slug)')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('system_prompt', models.TextField(blank=True, verbose_name='System prompt (for LLM)')),
                ('avatar_url', models.URLField(blank=True, max_length=512, verbose_name='Avatar URL')),
                ('is_active', models.BooleanField(default=True, verbose_name='Active')),
                ('is_free', models.BooleanField(default=False, verbose_name='Available on Free plan')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
            ],
            options={
                'verbose_name': 'AI Agent',
                'verbose_name_plural': 'AI Agents',
                'db_table': 'ai_agents',
                'ordering': ['role', 'name'],
            },
        ),
        migrations.CreateModel(
            name='WorkspaceAgent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_active', models.BooleanField(default=True, verbose_name='Active')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('agent', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='workspace_agents', to='ai.aiagent', verbose_name='Agent')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='workspace_agents', to='core.workspace', verbose_name='Workspace')),
            ],
            options={
                'verbose_name': 'Workspace Agent',
                'verbose_name_plural': 'Workspace Agents',
                'db_table': 'ai_workspace_agents',
                'ordering': ['workspace', 'agent'],
            },
        ),
        migrations.CreateModel(
            name='ChatMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('user', 'User'), ('assistant', 'Assistant')], max_length=20, verbose_name='Role')),
                ('content', models.TextField(verbose_name='Content')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_chat_messages', to=settings.AUTH_USER_MODEL, verbose_name='User')),
                ('workspace_agent', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='ai.workspaceagent', verbose_name='Workspace Agent')),
            ],
            options={
                'verbose_name': 'Chat Message',
                'verbose_name_plural': 'Chat Messages',
                'db_table': 'ai_chat_messages',
                'ordering': ['created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='workspaceagent',
            constraint=models.UniqueConstraint(fields=('workspace', 'agent'), name='ai_workspace_agent_unique'),
        ),
    ]
