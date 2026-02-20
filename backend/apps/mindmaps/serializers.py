"""
Serializers for Mind Maps.
"""
from rest_framework import serializers
from .models import MindMap


class MindMapSerializer(serializers.ModelSerializer):
    class Meta:
        model = MindMap
        fields = [
            'id', 'title', 'owner', 'workspace', 'project', 'related_workitem',
            'nodes', 'edges', 'is_personal', 'created_at', 'updated_at',
        ]
        read_only_fields = ['owner', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)
