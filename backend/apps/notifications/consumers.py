"""
WebSocket consumers for real-time updates.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()


class DashboardConsumer(AsyncWebsocketConsumer):
    """
    Consumer для личных обновлений пользователя (группа: dashboard_{user_id}).
    """
    
    async def connect(self):
        """Подключение к WebSocket."""
        self.user = self.scope["user"]
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.group_name = f"dashboard_{self.user.id}"
        
        # Присоединяемся к группе
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, close_code):
        """Отключение от WebSocket."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """Получение сообщения от клиента."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            # Обработка различных типов сообщений
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong'
                }))
        except json.JSONDecodeError:
            pass
    
    async def dashboard_update(self, event):
        """Отправка обновления дашборда."""
        await self.send(text_data=json.dumps({
            'type': 'dashboard_update',
            'data': event['data']
        }))
    
    async def task_update(self, event):
        """Отправка обновления задачи."""
        await self.send(text_data=json.dumps({
            'type': 'task_update',
            'data': event['data']
        }))
    
    async def notification(self, event):
        """Отправка уведомления."""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))


class KanbanConsumer(AsyncWebsocketConsumer):
    """
    Consumer для обновлений канбан-доски (группа: kanban_board_{board_id}).
    """
    
    async def connect(self):
        """Подключение к WebSocket."""
        self.user = self.scope["user"]
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.board_id = self.scope["url_route"]["kwargs"]["board_id"]
        self.group_name = f"kanban_board_{self.board_id}"
        
        # Проверяем доступ к доске
        has_access = await self.check_board_access(self.board_id)
        if not has_access:
            await self.close()
            return
        
        # Присоединяемся к группе
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, close_code):
        """Отключение от WebSocket."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """Получение сообщения от клиента."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'card_moved':
                # Перемещение карточки
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'card_moved',
                        'data': data.get('data', {})
                    }
                )
        except json.JSONDecodeError:
            pass
    
    @database_sync_to_async
    def check_board_access(self, board_id):
        """Проверка доступа к доске."""
        from apps.kanban.models import Board
        try:
            board = Board.objects.get(id=board_id)
            # Здесь можно добавить проверку прав доступа
            return True
        except Board.DoesNotExist:
            return False
    
    async def kanban_update(self, event):
        """Отправка обновления канбана."""
        await self.send(text_data=json.dumps({
            'type': 'kanban_update',
            'data': event['data']
        }))
    
    async def card_moved(self, event):
        """Отправка информации о перемещении карточки."""
        await self.send(text_data=json.dumps({
            'type': 'card_moved',
            'data': event['data']
        }))
    
    async def card_created(self, event):
        """Отправка информации о создании карточки."""
        await self.send(text_data=json.dumps({
            'type': 'card_created',
            'data': event['data']
        }))


class ProjectConsumer(AsyncWebsocketConsumer):
    """
    Consumer для обновлений проекта (группа: project_{project_id}).
    """
    
    async def connect(self):
        """Подключение к WebSocket."""
        self.user = self.scope["user"]
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.project_id = self.scope["url_route"]["kwargs"]["project_id"]
        self.group_name = f"project_{self.project_id}"
        
        # Проверяем доступ к проекту
        has_access = await self.check_project_access(self.project_id)
        if not has_access:
            await self.close()
            return
        
        # Присоединяемся к группе
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, close_code):
        """Отключение от WebSocket."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
    
    @database_sync_to_async
    def check_project_access(self, project_id):
        """Проверка доступа к проекту."""
        from apps.todo.models import Project
        try:
            project = Project.objects.get(id=project_id)
            # Здесь можно добавить проверку прав доступа
            return True
        except Project.DoesNotExist:
            return False
    
    async def project_update(self, event):
        """Отправка обновления проекта."""
        await self.send(text_data=json.dumps({
            'type': 'project_update',
            'data': event['data']
        }))
    
    async def task_created(self, event):
        """Отправка информации о создании задачи."""
        await self.send(text_data=json.dumps({
            'type': 'task_created',
            'data': event['data']
        }))
    
    async def task_updated(self, event):
        """Отправка информации об обновлении задачи."""
        await self.send(text_data=json.dumps({
            'type': 'task_updated',
            'data': event['data']
        }))
    
    async def task_deleted(self, event):
        """Отправка информации об удалении задачи."""
        await self.send(text_data=json.dumps({
            'type': 'task_deleted',
            'data': event['data']
        }))
