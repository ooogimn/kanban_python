"""
WebSocket Consumer для чата и комментариев в реальном времени.
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.contenttypes.models import ContentType
from apps.documents.models import Comment, Attachment
from apps.todo.models import WorkItem, Project

logger = logging.getLogger(__name__)

# Маппинг room_name -> (entity_type, model)
ENTITY_MAP = {
    'task': ('workitem', WorkItem),
    'workitem': ('workitem', WorkItem),
    'project': ('project', Project),
    'file': ('attachment', Attachment),
}


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Consumer для чата комнат.
    URL: ws/chat/<room_name>/ — room_name например task_15, project_7, file_123
    """

    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'
        self.user = self.scope.get('user')

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """При получении JSON — сохранить в БД и отправить в группу."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'error': 'Invalid JSON'}))
            return

        comment_data = await self.create_comment(data)
        if comment_data:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'comment': comment_data,
                }
            )

    async def chat_message(self, event):
        """Отправить данные комментария клиенту."""
        await self.send(text_data=json.dumps(event['comment']))

    @database_sync_to_async
    def create_comment(self, data):
        """
        Создать Comment в БД.
        data: { text, parent (id или null) }
        room_name: task_15 -> entity_type=workitem, entity_id=15
        """
        text = (data.get('text') or data.get('content', '')).strip()
        if not text:
            return None

        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return None

        parts = self.room_name.split('_', 1)
        if len(parts) != 2:
            return None

        prefix, entity_id_str = parts
        try:
            entity_id = int(entity_id_str)
        except ValueError:
            return None

        prefix_lower = prefix.lower()
        if prefix_lower not in ENTITY_MAP:
            return None

        _, model_class = ENTITY_MAP[prefix_lower]
        content_type = ContentType.objects.get_for_model(model_class)

        try:
            obj = model_class.objects.get(pk=entity_id)
        except model_class.DoesNotExist:
            return None

        parent = None
        parent_id = data.get('parent')
        if parent_id:
            try:
                parent = Comment.objects.get(pk=parent_id)
            except Comment.DoesNotExist:
                pass

        workitem = obj if isinstance(obj, WorkItem) else None
        comment = Comment.objects.create(
            content=text,
            author=user,
            content_type=content_type,
            object_id=entity_id,
            workitem=workitem,
            parent=parent,
        )

        return self._serialize_comment(comment)

    def _serialize_comment(self, comment):
        """Сериализация комментария для отправки по WebSocket."""
        user = comment.author
        author_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or str(user)
        author_avatar = user.avatar.url if user.avatar else None

        return {
            'id': comment.id,
            'author': user.id,
            'author_name': author_name,
            'author_avatar': author_avatar,
            'text': comment.content,
            'created_at': comment.created_at.isoformat(),
            'parent': comment.parent_id,
        }
