"""
Serializers for schedule app.
"""
from rest_framework import serializers
from .models import Resource, ScheduleEntry


class ResourceSerializer(serializers.ModelSerializer):
    """Сериализатор для Resource."""
    
    workspace_name = serializers.CharField(
        source='workspace.name',
        read_only=True
    )
    
    class Meta:
        model = Resource
        fields = [
            'id', 'name', 'description', 'workspace', 'workspace_name',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ScheduleEntrySerializer(serializers.ModelSerializer):
    """
    Сериализатор для ScheduleEntry с валидацией времени.
    
    Проверяет, что end_time > start_time.
    """
    
    resource_name = serializers.CharField(
        source='resource.name',
        read_only=True
    )
    workitem_title = serializers.CharField(
        source='related_workitem.title',
        read_only=True,
        allow_null=True
    )
    
    class Meta:
        model = ScheduleEntry
        fields = [
            'id', 'start_time', 'end_time', 'repeat_pattern',
            'resource', 'resource_name', 'related_workitem', 'workitem_title',
            'date', 'time', 'duration',  # старые поля для обратной совместимости
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, data):
        """
        Валидация: end_time должен быть позже start_time.
        """
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        if start_time and end_time:
            if end_time <= start_time:
                raise serializers.ValidationError({
                    'end_time': 'Время окончания должно быть позже времени начала.'
                })
        
        return data
