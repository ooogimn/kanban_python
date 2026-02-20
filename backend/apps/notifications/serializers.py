"""
Сериализаторы для приложения notifications.
"""
from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Сериализатор для журнала аудита (Activity Log)."""
    user_display = serializers.SerializerMethodField()
    action_display = serializers.SerializerMethodField()
    target_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'action_display',
            'model_name', 'object_id', 'target_display',
            'user', 'user_display', 'changes', 'timestamp',
        ]
        read_only_fields = fields

    def get_user_display(self, obj):
        if not obj.user:
            return 'Система'
        return obj.user.get_full_name() or obj.user.username or str(obj.user)

    def get_action_display(self, obj):
        labels = {
            AuditLog.ACTION_CREATE: 'Создание',
            AuditLog.ACTION_UPDATE: 'Изменение',
            AuditLog.ACTION_DELETE: 'Удаление',
        }
        return labels.get(obj.action, obj.action)

    def get_target_display(self, obj):
        """Краткое описание объекта (название задачи/проекта при наличии в changes)."""
        if isinstance(obj.changes, dict):
            name = obj.changes.get('title') or obj.changes.get('name')
            if name:
                return str(name)
        return f'{obj.model_name}#{obj.object_id}'
