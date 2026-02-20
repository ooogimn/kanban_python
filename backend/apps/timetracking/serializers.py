"""
Serializers for timetracking app.
"""
from rest_framework import serializers
from django.utils import timezone

from .models import TimeLog
from apps.core.models import User


class UserShortSerializer(serializers.ModelSerializer):
    """Краткий сериализатор пользователя."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class TimeLogSerializer(serializers.ModelSerializer):
    """Сериализатор для TimeLog."""
    
    user = UserShortSerializer(read_only=True)
    workitem_title = serializers.CharField(source='workitem.title', read_only=True)
    is_running = serializers.SerializerMethodField()
    elapsed_seconds = serializers.SerializerMethodField()
    
    class Meta:
        model = TimeLog
        fields = [
            'id', 'workitem', 'workitem_title', 'user',
            'started_at', 'stopped_at', 'duration_minutes',
            'description', 'billable', 'is_running', 'elapsed_seconds',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'user', 'duration_minutes']
    
    def get_is_running(self, obj) -> bool:
        """Проверка, запущен ли таймер."""
        return obj.stopped_at is None
    
    def get_elapsed_seconds(self, obj) -> int:
        """Текущее время в секундах (для бегущего таймера)."""
        if obj.stopped_at is None:
            delta = timezone.now() - obj.started_at
            return int(delta.total_seconds())
        elif obj.duration_minutes:
            return obj.duration_minutes * 60
        return 0


class TimeLogCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания TimeLog."""
    
    class Meta:
        model = TimeLog
        fields = ['workitem', 'description', 'billable']
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        validated_data['started_at'] = timezone.now()
        return super().create(validated_data)


class StartTimerSerializer(serializers.Serializer):
    """Сериализатор для запуска таймера."""
    
    workitem_id = serializers.IntegerField()
    description = serializers.CharField(required=False, allow_blank=True, default='')
    billable = serializers.BooleanField(default=True)


class StopTimerSerializer(serializers.Serializer):
    """Сериализатор для остановки таймера."""
    
    description = serializers.CharField(required=False, allow_blank=True)
