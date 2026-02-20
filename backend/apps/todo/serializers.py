"""
Serializers for todo app.
"""
from rest_framework import serializers
from apps.core.models import User, ProjectMember
from apps.core.serializers import ProjectMemberSerializer
from apps.documents.models import Tag, Comment, WikiPage, Attachment
from apps.kanban.models import Stage
from .models import Project, WorkItem, ChecklistItem


class ChecklistItemSerializer(serializers.ModelSerializer):
    """Сериализатор для подзадачи (чек-лист)."""

    class Meta:
        model = ChecklistItem
        fields = ['id', 'workitem', 'title', 'is_done', 'sort_order']
        read_only_fields = []


class UserBasicSerializer(serializers.ModelSerializer):
    """Базовый сериализатор для User."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'avatar']


class ProjectSerializer(serializers.ModelSerializer):
    """Сериализатор для Project."""
    
    owner = UserBasicSerializer(read_only=True)
    owner_id = serializers.IntegerField(write_only=True, required=False)
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    logo = serializers.ImageField(required=False, allow_null=True, write_only=True)
    logo_url = serializers.SerializerMethodField(read_only=True)
    members = ProjectMemberSerializer(many=True, read_only=True)
    progress = serializers.IntegerField(read_only=True)
    health_status = serializers.CharField(read_only=True)
    
    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'status', 'workspace', 'workspace_name',
            'owner', 'owner_id', 'start_date', 'end_date', 'budget',
            'logo', 'logo_url',
            'progress', 'health_status', 'members',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_logo_url(self, obj):
        """Полный URL логотипа для фронтенда."""
        if obj.logo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url
        return None

    def validate_logo(self, value):
        """Ограничение: изображения до 5 МБ, форматы JPEG/PNG/GIF/WebP."""
        if not value:
            return value
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Размер файла не должен превышать 5 МБ.')
        allowed = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
        if getattr(value, 'content_type', None) not in allowed:
            raise serializers.ValidationError('Допустимые форматы: JPEG, PNG, GIF, WebP.')
        return value
    
    def update(self, instance, validated_data):
        """Обновление проекта с корректной обработкой логотипа."""
        logo = validated_data.pop('logo', None)
        
        # Обновляем обычные поля
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Обрабатываем логотип
        if logo is not None:
            # Удаляем старый логотип, если он есть
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = logo
        
        instance.save()
        return instance


class WorkItemSerializer(serializers.ModelSerializer):
    """Сериализатор для WorkItem."""

    checklist = ChecklistItemSerializer(source='checklist_items', many=True, read_only=True)
    checklist_stats = serializers.SerializerMethodField(read_only=True)

    assigned_to = UserBasicSerializer(many=True, read_only=True)
    assigned_to_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        write_only=True,
        required=False
    )
    watchers = UserBasicSerializer(many=True, read_only=True)
    watcher_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        write_only=True,
        required=False
    )
    tags = serializers.StringRelatedField(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Tag.objects.all(),
        write_only=True,
        required=False
    )
    dependencies = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=WorkItem.objects.all(),
        write_only=True,
        required=False
    )
    project_name = serializers.CharField(source='project.name', read_only=True)
    created_by = UserBasicSerializer(read_only=True)
    source_type = serializers.SerializerMethodField(read_only=True)
    source_id = serializers.SerializerMethodField(read_only=True)
    source_details = serializers.SerializerMethodField(read_only=True)
    responsible = ProjectMemberSerializer(read_only=True)
    responsible_id = serializers.PrimaryKeyRelatedField(
        queryset=ProjectMember.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        source='responsible',
    )
    stage = serializers.PrimaryKeyRelatedField(
        queryset=Stage.objects.all(),
        required=False,
        allow_null=True,
    )
    
    class Meta:
        model = WorkItem
        fields = [
            'id', 'title', 'description', 'status', 'priority', 'due_date',
            'start_date', 'completed_at', 'progress', 'estimated_hours',
            'actual_hours', 'project', 'project_name', 'created_by',
            'assigned_to', 'assigned_to_ids', 'watchers', 'watcher_ids',
            'tags', 'tag_ids', 'dependencies', 'created_at', 'updated_at',
            'version', 'source_type', 'source_id', 'source_details',
            'stage', 'kanban_column', 'sort_order',
            'responsible', 'responsible_id',
            'color',
            'checklist', 'checklist_stats',
        ]
        read_only_fields = ['created_at', 'updated_at', 'version', 'created_by']

    def get_checklist_stats(self, obj):
        """Статистика чек-листа: {total, done}."""
        items = getattr(obj, 'checklist_items', None)
        if items is None:
            return {'total': 0, 'done': 0}
        if hasattr(items, 'all'):
            items = list(items.all())
        total = len(items)
        done = sum(1 for i in items if i.is_done)
        return {'total': total, 'done': done}
    
    def get_source_type(self, obj):
        if obj.source_content_type_id is None:
            return None
        ct = obj.source_content_type
        if ct is None:
            return None
        return ct.model
    
    def get_source_id(self, obj):
        return obj.source_object_id
    
    def get_source_details(self, obj):
        """Ссылка на источник (запись/комментарий) для отображения на странице задачи."""
        if obj.source_content_type_id is None or obj.source_object_id is None:
            return None
        ct = obj.source_content_type
        if ct is None:
            return None
        if ct.model == 'wikipage':
            try:
                page = WikiPage.objects.filter(pk=obj.source_object_id).select_related('project').first()
                if page:
                    return {
                        'type': 'wikipage',
                        'id': page.id,
                        'url': f'/projects/{page.project_id}/wiki/page/{page.id}',
                        'label': page.title[:100] or 'Запись',
                    }
            except Exception:
                pass
            return {'type': 'wikipage', 'id': obj.source_object_id, 'url': None, 'label': 'Запись'}
        if ct.model == 'comment':
            try:
                comment = Comment.objects.filter(pk=obj.source_object_id).select_related('workitem', 'content_type').first()
                if comment:
                    label = (comment.content or '')[:80].replace('\n', ' ') or 'Комментарий'
                    if comment.workitem_id:
                        return {
                            'type': 'comment',
                            'id': comment.id,
                            'url': f'/tasks/{comment.workitem_id}',
                            'label': label,
                        }
                    # Комментарий к файлу / проекту — ссылка на проект или задачу
                    if comment.content_type_id and comment.object_id:
                        ctype = comment.content_type
                        if ctype.model == 'workitem':
                            return {'type': 'comment', 'id': comment.id, 'url': f'/tasks/{comment.object_id}', 'label': label}
                        if ctype.model == 'project':
                            return {'type': 'comment', 'id': comment.id, 'url': f'/projects/{comment.object_id}', 'label': label}
                        if ctype.model == 'attachment':
                            att = Attachment.objects.filter(pk=comment.object_id).select_related('project').first()
                            if att and att.project_id:
                                return {'type': 'comment', 'id': comment.id, 'url': f'/projects/{att.project_id}', 'label': label}
                    return {'type': 'comment', 'id': comment.id, 'url': None, 'label': label}
            except Exception:
                pass
            return {'type': 'comment', 'id': obj.source_object_id, 'url': None, 'label': 'Комментарий'}
        return None
    
    def create(self, validated_data):
        """Создание WorkItem с обработкой M2M полей. Без проекта — подставляем личный проект пользователя."""
        assigned_to_ids = validated_data.pop('assigned_to_ids', [])
        watcher_ids = validated_data.pop('watcher_ids', [])
        tag_ids = validated_data.pop('tag_ids', [])
        dependencies = validated_data.pop('dependencies', [])
        request = self.context['request']

        if not validated_data.get('project'):
            from apps.core.services import get_default_workspace_and_project
            _, default_proj = get_default_workspace_and_project(request.user)
            if default_proj:
                validated_data['project'] = default_proj

        validated_data['created_by'] = request.user
        workitem = WorkItem.objects.create(**validated_data)
        
        # Устанавливаем M2M связи
        if assigned_to_ids:
            workitem.assigned_to.set(assigned_to_ids)
        if watcher_ids:
            workitem.watchers.set(watcher_ids)
        if tag_ids:
            workitem.tags.set(tag_ids)
        if dependencies:
            workitem.dependencies.set(dependencies)
        
        return workitem
    
    def update(self, instance, validated_data):
        """Обновление WorkItem с обработкой M2M полей."""
        assigned_to_ids = validated_data.pop('assigned_to_ids', None)
        watcher_ids = validated_data.pop('watcher_ids', None)
        tag_ids = validated_data.pop('tag_ids', None)
        dependencies = validated_data.pop('dependencies', None)
        
        # Обновляем версию
        validated_data['version'] = instance.version + 1
        
        # Обновляем поля
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Обновляем M2M связи, если они переданы
        if assigned_to_ids is not None:
            instance.assigned_to.set(assigned_to_ids)
        if watcher_ids is not None:
            instance.watchers.set(watcher_ids)
        if tag_ids is not None:
            instance.tags.set(tag_ids)
        if dependencies is not None:
            instance.dependencies.set(dependencies)
        
        return instance


class WorkItemListSerializer(serializers.ModelSerializer):
    """Упрощённый сериализатор для списка WorkItem."""

    assigned_to_count = serializers.IntegerField(source='assigned_to.count', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    checklist_stats = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = WorkItem
        fields = [
            'id', 'title', 'status', 'priority', 'due_date', 'progress',
            'project', 'project_name', 'assigned_to_count', 'created_at',
            'color', 'checklist_stats', 'stage',
        ]

    def get_checklist_stats(self, obj):
        """Статистика подзадач: {total, done} — как во вкладке «Подзадачи» модалки."""
        items = getattr(obj, 'checklist_items', None)
        if items is None:
            return {'total': 0, 'done': 0}
        if hasattr(items, 'all'):
            items = list(items.all())
        return {'total': len(items), 'done': sum(1 for i in items if i.is_done)}
