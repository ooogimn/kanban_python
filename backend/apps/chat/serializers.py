"""
Serializers для чата — данные комментария для WebSocket.
"""
from rest_framework import serializers
from apps.documents.models import Comment
from apps.core.models import User


class ChatCommentSerializer(serializers.ModelSerializer):
    """
    Сериализатор комментария для WebSocket.
    Возвращает: id, author (имя, аватар), text, created_at, parent.
    """
    text = serializers.CharField(source='content', read_only=True)
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'author', 'author_name', 'author_avatar', 'text', 'created_at', 'parent']

    def get_author_name(self, obj):
        """Имя автора (first_name + last_name или username)."""
        user = obj.author
        if user.first_name or user.last_name:
            return f"{user.first_name or ''} {user.last_name or ''}".strip()
        return user.username or user.email or str(user)

    def get_author_avatar(self, obj):
        """URL аватара автора."""
        user = obj.author
        if user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(user.avatar.url)
            return user.avatar.url
        return None
