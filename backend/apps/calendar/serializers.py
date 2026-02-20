"""
Serializers for calendar app.
"""
from rest_framework import serializers
from apps.core.models import User
from .models import CalendarEvent


class UserBasicSerializer(serializers.ModelSerializer):
    """Базовый сериализатор для User."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class CalendarEventSerializer(serializers.ModelSerializer):
    """Сериализатор для CalendarEvent."""
    
    owner = UserBasicSerializer(read_only=True)
    attendees = UserBasicSerializer(many=True, read_only=True)
    attendee_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        write_only=True,
        required=False
    )
    related_workitem_title = serializers.CharField(
        source='related_workitem.title',
        read_only=True
    )
    
    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'description', 'start_date', 'end_date', 'all_day',
            'recurrence_rule', 'color', 'location', 'related_workitem',
            'related_workitem_title', 'owner', 'attendees', 'attendee_ids',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'owner']
    
    def create(self, validated_data):
        """Создание CalendarEvent с обработкой M2M полей."""
        attendee_ids = validated_data.pop('attendee_ids', [])
        validated_data['owner'] = self.context['request'].user
        event = CalendarEvent.objects.create(**validated_data)
        if attendee_ids:
            event.attendees.set(attendee_ids)
        return event
    
    def update(self, instance, validated_data):
        """Обновление CalendarEvent с обработкой M2M полей."""
        attendee_ids = validated_data.pop('attendee_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if attendee_ids is not None:
            instance.attendees.set(attendee_ids)
        return instance
