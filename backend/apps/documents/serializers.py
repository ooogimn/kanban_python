"""
Serializers for documents app.
"""
from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from apps.core.models import User, Workspace
from apps.todo.models import Project, WorkItem
from apps.schedule.models import ScheduleEntry
from .models import Attachment, Comment, WikiPage, Tag
from .utils import can_preview_in_browser, get_google_viewer_url


class UserBasicSerializer(serializers.ModelSerializer):
    """Базовый сериализатор для User."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'avatar']


class AttachmentSerializer(serializers.ModelSerializer):
    """Базовый сериализатор для Attachment."""
    
    uploaded_by = UserBasicSerializer(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    file_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    can_preview = serializers.SerializerMethodField()
    google_preview_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Attachment
        fields = [
            'id', 'filename', 'file', 'file_url', 'size', 'mime_type', 'file_type',
            'project', 'project_name', 'is_public', 'uploaded_by', 'created_at',
            'preview_url', 'can_preview', 'google_preview_url'
        ]
        read_only_fields = ['created_at', 'file_type']
    
    def get_file_url(self, obj):
        """Возвращает URL файла."""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_preview_url(self, obj):
        """Возвращает URL для просмотра файла."""
        if can_preview_in_browser(obj.mime_type):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(f'/api/v1/documents/attachments/{obj.id}/preview/')
        return None
    
    def get_can_preview(self, obj):
        """Проверяет, можно ли просматривать файл в браузере."""
        return can_preview_in_browser(obj.mime_type)
    
    def get_google_preview_url(self, obj):
        """Возвращает URL для Google Docs/Sheets viewer (если применимо)."""
        if obj.mime_type in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']:
            request = self.context.get('request')
            if request and obj.is_public:
                file_url = request.build_absolute_uri(obj.file.url)
                return get_google_viewer_url(file_url, obj.mime_type)
        return None


class AttachmentCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания Attachment (загрузка файла)."""
    
    entity_type = serializers.ChoiceField(
        choices=['project', 'workitem', 'schedule'],
        write_only=True,
        required=True
    )
    entity_id = serializers.IntegerField(write_only=True, required=True)
    
    class Meta:
        model = Attachment
        fields = ['file', 'entity_type', 'entity_id', 'is_public']
    
    def validate(self, attrs):
        """Валидация данных."""
        entity_type = attrs.get('entity_type')
        entity_id = attrs.get('entity_id')
        
        # Определяем ContentType
        model_map = {
            'project': Project,
            'workitem': WorkItem,
            'schedule': ScheduleEntry,
        }
        
        if entity_type not in model_map:
            raise serializers.ValidationError(f"Неизвестный тип сущности: {entity_type}")
        
        model_class = model_map[entity_type]
        content_type = ContentType.objects.get_for_model(model_class)
        
        # Проверяем существование объекта
        try:
            obj = model_class.objects.get(pk=entity_id)
            attrs['content_object'] = obj
            attrs['content_type'] = content_type
            attrs['object_id'] = entity_id
            
            # Определяем project
            project = None
            if entity_type == 'project':
                # obj — сам проект
                project = obj
            elif hasattr(obj, 'project'):
                project = obj.project
            elif hasattr(obj, 'related_workitem') and obj.related_workitem:
                if obj.related_workitem.project:
                    project = obj.related_workitem.project
            
            if project:
                attrs['project'] = project
        except model_class.DoesNotExist:
            raise serializers.ValidationError(f"{entity_type} с id={entity_id} не найден")
        
        return attrs
    
    def create(self, validated_data):
        """Создание Attachment."""
        file = validated_data.pop('file')
        entity_type = validated_data.pop('entity_type')
        entity_id = validated_data.pop('entity_id')
        content_object = validated_data.pop('content_object')
        content_type = validated_data.pop('content_type')
        validated_data.pop('object_id', None)  # уже передаём как object_id=entity_id
        
        # Определяем filename и mime_type
        filename = file.name
        import mimetypes
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            mime_type = 'application/octet-stream'
        
        # Создаем Attachment
        attachment = Attachment.objects.create(
            file=file,
            filename=filename,
            size=file.size,
            mime_type=mime_type,
            content_type=content_type,
            object_id=entity_id,
            uploaded_by=self.context['request'].user,
            **validated_data
        )
        
        return attachment


class AttachmentDetailSerializer(AttachmentSerializer):
    """Детальный сериализатор для Attachment."""
    
    content_object_type = serializers.SerializerMethodField()
    content_object_id = serializers.SerializerMethodField()
    
    class Meta(AttachmentSerializer.Meta):
        fields = AttachmentSerializer.Meta.fields + ['content_object_type', 'content_object_id']
    
    def get_content_object_type(self, obj):
        """Возвращает тип связанного объекта."""
        if obj.content_type:
            return obj.content_type.model
        elif obj.workitem:
            return 'workitem'
        return None
    
    def get_content_object_id(self, obj):
        """Возвращает ID связанного объекта."""
        if obj.object_id:
            return obj.object_id
        elif obj.workitem:
            return obj.workitem.id
        return None


class CommentSerializer(serializers.ModelSerializer):
    """Базовый сериализатор для Comment."""
    
    author = UserBasicSerializer(read_only=True)
    replies_count = serializers.IntegerField(source='replies.count', read_only=True)
    
    class Meta:
        model = Comment
        fields = [
            'id', 'content', 'author', 'parent', 'replies_count',
            'is_edited', 'edited_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'is_edited', 'edited_at']


class CommentCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания Comment."""
    
    entity_type = serializers.ChoiceField(
        choices=['workitem', 'attachment', 'project'],
        write_only=True,
        required=True
    )
    entity_id = serializers.IntegerField(write_only=True, required=True)
    parent_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Comment
        fields = ['content', 'entity_type', 'entity_id', 'parent_id']
    
    def validate(self, attrs):
        """Валидация данных."""
        entity_type = attrs.get('entity_type')
        entity_id = attrs.get('entity_id')
        parent_id = attrs.get('parent_id')
        
        # Определяем ContentType
        model_map = {
            'workitem': WorkItem,
            'attachment': Attachment,
            'project': Project,
        }
        
        if entity_type not in model_map:
            raise serializers.ValidationError(f"Неизвестный тип сущности: {entity_type}")
        
        model_class = model_map[entity_type]
        content_type = ContentType.objects.get_for_model(model_class)
        
        # Проверяем существование объекта
        try:
            obj = model_class.objects.get(pk=entity_id)
            attrs['content_object'] = obj
            attrs['content_type'] = content_type
            attrs['object_id'] = entity_id
        except model_class.DoesNotExist:
            raise serializers.ValidationError(f"{entity_type} с id={entity_id} не найден")
        
        # Проверяем parent, если указан
        if parent_id:
            try:
                parent = Comment.objects.get(pk=parent_id)
                attrs['parent'] = parent
            except Comment.DoesNotExist:
                raise serializers.ValidationError(f"Родительский комментарий с id={parent_id} не найден")
        
        return attrs
    
    def create(self, validated_data):
        """Создание Comment."""
        entity_type = validated_data.pop('entity_type')
        entity_id = validated_data.pop('entity_id')
        content_object = validated_data.pop('content_object')
        content_type = validated_data.pop('content_type')
        parent = validated_data.pop('parent', None)
        
        # Для обратной совместимости: если это workitem, сохраняем и workitem
        workitem = None
        if entity_type == 'workitem' and isinstance(content_object, WorkItem):
            workitem = content_object
        
        comment = Comment.objects.create(
            content=validated_data['content'],
            author=self.context['request'].user,
            content_type=content_type,
            object_id=entity_id,
            workitem=workitem,  # Для обратной совместимости
            parent=parent,
        )
        
        return comment


class CommentThreadSerializer(CommentSerializer):
    """Сериализатор для Comment с вложенными ответами (threaded)."""
    
    replies = serializers.SerializerMethodField()
    
    class Meta(CommentSerializer.Meta):
        fields = CommentSerializer.Meta.fields + ['replies']
    
    def get_replies(self, obj):
        """Возвращает вложенные комментарии (ответы)."""
        replies = obj.replies.all().order_by('created_at')
        return CommentThreadSerializer(replies, many=True, context=self.context).data


class WikiPageSerializer(serializers.ModelSerializer):
    """Сериализатор для WikiPage (записка). project и workitem опциональны."""
    
    author = UserBasicSerializer(read_only=True)
    project_name = serializers.SerializerMethodField()
    parent_title = serializers.CharField(source='parent.title', read_only=True, allow_null=True)
    children_count = serializers.IntegerField(source='children.count', read_only=True)
    attachments_count = serializers.IntegerField(source='attachments.count', read_only=True)
    tags = serializers.StringRelatedField(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Tag.objects.all(),
        write_only=True,
        required=False
    )
    workspace = serializers.PrimaryKeyRelatedField(
        queryset=Workspace.objects.all(),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = WikiPage
        fields = [
            'id', 'title', 'content', 'slug', 'workspace', 'project', 'project_name',
            'workitem', 'parent', 'parent_title', 'author', 'is_published', 'order',
            'color', 'children_count', 'attachments_count', 'tags', 'tag_ids',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'slug']
    
    def get_project_name(self, obj):
        return obj.project.name if obj.project_id else None
    
    def create(self, validated_data):
        """Создание WikiPage. Без project/workspace — личная заметка (workspace=None, project=None)."""
        from django.utils.text import slugify

        tag_ids = validated_data.pop('tag_ids', [])
        request = self.context['request']
        project = validated_data.get('project')
        workspace = validated_data.get('workspace')

        if project:
            validated_data['workspace_id'] = project.workspace_id
        elif workspace:
            validated_data['workspace_id'] = workspace.id
        else:
            # По умолчанию — личное пространство и личный проект пользователя (если есть)
            from apps.core.services import get_default_workspace_and_project
            default_ws, default_proj = get_default_workspace_and_project(request.user)
            if default_ws and default_proj:
                validated_data['workspace_id'] = default_ws.id
                validated_data['project'] = default_proj
            else:
                validated_data['workspace_id'] = None
                validated_data['project'] = None

        project = validated_data.get('project')
        if 'slug' not in validated_data or not validated_data.get('slug'):
            base_slug = slugify(validated_data['title']) or 'page'
            slug = base_slug
            counter = 1
            if project:
                while WikiPage.objects.filter(project=project, slug=slug).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
            elif validated_data.get('workspace_id'):
                ws_id = validated_data['workspace_id']
                while WikiPage.objects.filter(
                    workspace_id=ws_id, project__isnull=True, slug=slug
                ).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
            else:
                # Личный scope: уникальность (author, slug)
                while WikiPage.objects.filter(
                    author=request.user,
                    workspace__isnull=True,
                    project__isnull=True,
                    slug=slug,
                ).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
            validated_data['slug'] = slug

        validated_data['author'] = request.user
        if 'workspace' in validated_data:
            validated_data.pop('workspace')
        wikipage = WikiPage.objects.create(**validated_data)
        if tag_ids:
            wikipage.tags.set(tag_ids)
        return wikipage
    
    def update(self, instance, validated_data):
        """Обновление WikiPage. При смене project автоматически проставляем workspace."""
        tag_ids = validated_data.pop('tag_ids', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if validated_data.get('project') is not None and instance.project_id:
            instance.workspace_id = instance.project.workspace_id
        instance.save()

        if tag_ids is not None:
            instance.tags.set(tag_ids)

        return instance


class WikiPageTreeSerializer(serializers.ModelSerializer):
    """Сериализатор для иерархического дерева WikiPage."""
    
    author = UserBasicSerializer(read_only=True)
    children = serializers.SerializerMethodField()
    full_path = serializers.CharField(source='get_full_path', read_only=True)
    
    class Meta:
        model = WikiPage
        fields = [
            'id', 'title', 'slug', 'workspace', 'project', 'workitem', 'parent', 'author',
            'is_published', 'order', 'color', 'children', 'full_path', 'created_at'
        ]
    
    def get_children(self, obj):
        """Возвращает дочерние страницы. При scope=personal — все страницы автора (полное дерево блокнота)."""
        from django.db.models import Q
        request = self.context.get('request')
        scope = self.context.get('scope')
        qs = obj.children.order_by('order', 'title')
        if scope == 'personal' and request and request.user.is_authenticated:
            children = qs.filter(author=request.user)
        elif request and request.user.is_authenticated:
            children = qs.filter(Q(is_published=True) | Q(author=request.user))
        else:
            children = qs.filter(is_published=True)
        return WikiPageTreeSerializer(children, many=True, context=self.context).data
