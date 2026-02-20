"""
Сериализаторы для AI Marketplace и чата (SaaS Sprint 3).
"""
from rest_framework import serializers

from .models import AiAgent, WorkspaceAgent, ChatMessage


class AiAgentSerializer(serializers.ModelSerializer):
    """Каталог агентов — для маркетплейса и учётной карточки (включая system_prompt)."""

    class Meta:
        model = AiAgent
        fields = [
            'id', 'name', 'role', 'description', 'system_prompt', 'avatar_url',
            'monthly_cost', 'is_active', 'is_free', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class WorkspaceAgentSerializer(serializers.ModelSerializer):
    """Нанятый агент в workspace с данными агента и статистикой."""
    agent = AiAgentSerializer(read_only=True)
    agent_id = serializers.PrimaryKeyRelatedField(
        queryset=AiAgent.objects.filter(is_active=True),
        source='agent',
        write_only=True,
        required=False,
    )
    message_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = WorkspaceAgent
        fields = ['id', 'workspace', 'agent', 'agent_id', 'message_count', 'is_active', 'created_at']
        read_only_fields = ['id', 'workspace', 'agent', 'message_count', 'created_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    """Сообщение в чате."""

    class Meta:
        model = ChatMessage
        fields = ['id', 'workspace_agent', 'user', 'role', 'content', 'created_at']
        read_only_fields = fields
