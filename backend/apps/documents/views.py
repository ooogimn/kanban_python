"""
Views for documents app.
"""
import os
import mimetypes
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType

from .models import Attachment, Comment, WikiPage
from .serializers import (
    AttachmentSerializer, AttachmentCreateSerializer, AttachmentDetailSerializer,
    CommentSerializer, CommentCreateSerializer, CommentThreadSerializer,
    WikiPageSerializer, WikiPageTreeSerializer
)
from .permissions import HasProjectAccess, CanEditComment, CanEditWikiPage
from .utils import can_preview_in_browser, get_google_viewer_url
from apps.auth.permissions import IsWorkspaceMember
from apps.core.models import WorkspaceMember
from apps.todo.models import Project, WorkItem
from apps.todo.serializers import WorkItemSerializer
from apps.schedule.models import ScheduleEntry


class AttachmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления вложениями (файлами).
    """
    queryset = Attachment.objects.all()
    permission_classes = [IsWorkspaceMember, HasProjectAccess]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'file_type', 'is_public']
    search_fields = ['filename']
    ordering_fields = ['created_at', 'filename', 'size']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Выбор сериализатора в зависимости от действия."""
        if self.action == 'create':
            return AttachmentCreateSerializer
        elif self.action == 'retrieve':
            return AttachmentDetailSerializer
        return AttachmentSerializer
    
    def get_parser_classes(self):
        """Парсеры для загрузки файлов."""
        if self.action == 'create':
            return [MultiPartParser, FormParser]
        return super().get_parser_classes()
    
    def get_queryset(self):
        """Фильтрация вложений."""
        queryset = super().get_queryset()
        
        # Фильтр по типу сущности
        entity_type = self.request.query_params.get('entity_type')
        entity_id = self.request.query_params.get('entity_id')
        
        if entity_type and entity_id:
            try:
                model_map = {
                    'project': Project,
                    'workitem': WorkItem,
                    'schedule': ScheduleEntry,
                }
                model_class = model_map.get(entity_type)
                if model_class:
                    content_type = ContentType.objects.get_for_model(model_class)
                    queryset = queryset.filter(
                        content_type=content_type,
                        object_id=entity_id
                    )
            except (ContentType.DoesNotExist, KeyError):
                pass
        
        # Фильтр по проекту
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        return queryset.select_related('project', 'uploaded_by').prefetch_related('content_type')
    
    def perform_create(self, serializer):
        """Создание вложения."""
        serializer.save()

    def create(self, request, *args, **kwargs):
        """Создание вложения и возврат полных данных (id, file_url) для вставки в редактор."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = serializer.instance
        # Возвращаем полный объект с file_url для отображения изображений
        out_serializer = AttachmentSerializer(instance, context={'request': request})
        return Response(out_serializer.data, status=201)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Скачивание файла."""
        attachment = self.get_object()
        
        if not attachment.file:
            raise Http404("File not found")
        
        response = FileResponse(
            attachment.file.open('rb'),
            content_type=attachment.mime_type
        )
        response['Content-Disposition'] = f'attachment; filename="{attachment.filename}"'
        return response
    
    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Просмотр файла в браузере."""
        attachment = self.get_object()
        
        if not attachment.file:
            raise Http404("File not found")
        
        # Для Excel/Word - возвращаем URL для Google Docs/Sheets viewer
        if attachment.mime_type in [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]:
            if attachment.is_public:
                file_url = request.build_absolute_uri(attachment.file.url)
                google_url = get_google_viewer_url(file_url, attachment.mime_type)
                if google_url:
                    return Response({
                        'preview_url': google_url,
                        'type': 'google_viewer',
                        'file_url': file_url
                    })
            
            # Если файл приватный или Google viewer недоступен, возвращаем файл для скачивания
            return Response({
                'preview_url': None,
                'type': 'download',
                'download_url': request.build_absolute_uri(f'/api/v1/documents/attachments/{attachment.id}/download/')
            })
        
        # Для файлов, которые можно просматривать в браузере
        if can_preview_in_browser(attachment.mime_type):
            response = FileResponse(
                attachment.file.open('rb'),
                content_type=attachment.mime_type
            )
            response['Content-Disposition'] = f'inline; filename="{attachment.filename}"'
            return response
        
        # Для остальных типов - редирект на скачивание
        return Response({
            'preview_url': None,
            'type': 'download',
            'download_url': request.build_absolute_uri(f'/api/v1/documents/attachments/{attachment.id}/download/')
        })
    
    def perform_destroy(self, instance):
        """Удаление файла и физического файла."""
        if instance.file:
            # Удаляем физический файл
            try:
                if os.path.isfile(instance.file.path):
                    os.remove(instance.file.path)
            except (ValueError, OSError):
                # Файл может быть в другом хранилище (S3 и т.д.)
                pass
        instance.delete()


class CommentViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления комментариями.
    """
    queryset = Comment.objects.all()
    permission_classes = [IsWorkspaceMember, HasProjectAccess, CanEditComment]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['content']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Выбор сериализатора в зависимости от действия."""
        if self.action == 'create':
            return CommentCreateSerializer
        elif self.action == 'list' or self.action == 'retrieve':
            return CommentThreadSerializer
        return CommentSerializer
    
    def get_queryset(self):
        """Фильтрация комментариев."""
        queryset = super().get_queryset()
        
        # Фильтр по типу сущности
        entity_type = self.request.query_params.get('entity_type')
        entity_id = self.request.query_params.get('entity_id')
        
        if entity_type and entity_id:
            try:
                model_map = {
                    'workitem': WorkItem,
                    'attachment': Attachment,
                    'project': Project,
                }
                model_class = model_map.get(entity_type)
                if model_class:
                    content_type = ContentType.objects.get_for_model(model_class)
                    # Получаем только корневые комментарии (без родителя)
                    # Ответы будут вложены через CommentThreadSerializer
                    queryset = queryset.filter(
                        content_type=content_type,
                        object_id=entity_id,
                        parent__isnull=True  # Только корневые комментарии
                    )
            except (ContentType.DoesNotExist, KeyError):
                pass
        
        # Для обратной совместимости - фильтр по workitem
        workitem_id = self.request.query_params.get('workitem_id')
        if workitem_id:
            queryset = queryset.filter(
                workitem_id=workitem_id,
                parent__isnull=True  # Только корневые комментарии
            )
        
        return queryset.select_related('author', 'parent', 'content_type').prefetch_related('replies')
    
    def perform_create(self, serializer):
        """Создание комментария."""
        serializer.save()
    
    def perform_update(self, serializer):
        """Обновление комментария с отметкой редактирования."""
        instance = serializer.save()
        instance.is_edited = True
        instance.edited_at = timezone.now()
        instance.save()
    
    def perform_destroy(self, instance):
        """Мягкое удаление комментария (помечаем как удаленный, но сохраняем)."""
        # Вместо физического удаления, можно пометить как удаленный
        # Для простоты пока используем физическое удаление
        instance.delete()

    @action(detail=True, methods=['post'], url_path='create-task')
    def create_task(self, request, pk=None):
        """Создать задачу из комментария. Текст комментария → название/описание задачи."""
        comment = self.get_object()
        project = None
        if comment.workitem_id:
            project = comment.workitem.project if comment.workitem else None
        if project is None and comment.content_type_id and comment.object_id:
            obj = comment.content_object
            if obj is not None:
                if hasattr(obj, 'project') and obj.project_id:
                    project = obj.project
                elif isinstance(obj, Project):
                    project = obj
        if not project:
            return Response(
                {'detail': 'Не удалось определить проект для задачи (комментарий не привязан к проекту).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        title = (comment.content[:200].replace('\n', ' ') or 'Задача из комментария').strip()
        task = WorkItem.objects.create(
            title=title,
            description=comment.content,
            project=project,
            created_by=request.user,
            source_content_type=ContentType.objects.get_for_model(Comment),
            source_object_id=comment.id,
        )
        serializer = WorkItemSerializer(task, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WikiPageViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления Wiki страницами.
    """
    queryset = WikiPage.objects.filter(is_published=True)
    permission_classes = [IsWorkspaceMember, CanEditWikiPage]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'author', 'is_published', 'parent']
    search_fields = ['title', 'content']
    ordering_fields = ['order', 'title', 'created_at']
    ordering = ['order', 'title']
    
    def get_serializer_class(self):
        """Выбор сериализатора в зависимости от действия."""
        if self.action == 'tree':
            return WikiPageTreeSerializer
        return WikiPageSerializer
    
    def get_queryset(self):
        """Фильтрация Wiki страниц. Базовый набор: (записки воркспейсов пользователя) | (личные заметки автора)."""
        request = self.request
        select_prefetch = lambda q: q.select_related(
            'project', 'workspace', 'author', 'parent', 'workitem'
        ).prefetch_related('attachments', 'tags', 'watchers', 'children')

        # Строго личные заметки для модалки «Прикрепить существующую» и для дерева
        if request.query_params.get('scope') == 'personal':
            if not request.user.is_authenticated:
                return WikiPage.objects.none()
            return select_prefetch(
                WikiPage.objects.filter(
                    author=request.user,
                    workspace__isnull=True,
                    project__isnull=True,
                )
            )

        # Базовый QuerySet: записки воркспейсов пользователя ИЛИ личные заметки автора (чтобы retrieve по id не давал 404)
        if not request.user.is_authenticated:
            return WikiPage.objects.none()
        user_workspace_ids = list(
            WorkspaceMember.objects.filter(user=request.user).values_list('workspace_id', flat=True)
        )
        q_workspace = Q(workspace_id__in=user_workspace_ids) | Q(project__workspace_id__in=user_workspace_ids)
        q_personal = Q(author=request.user, workspace__isnull=True, project__isnull=True)
        queryset = WikiPage.objects.filter(
            (Q(is_published=True) & q_workspace) | q_personal
        )

        workspace_id = request.query_params.get('workspace_id')
        if workspace_id:
            if int(workspace_id) not in user_workspace_ids:
                return WikiPage.objects.none()
            queryset = queryset.filter(
                Q(workspace_id=workspace_id) | Q(project__workspace_id=workspace_id)
            )

        project_id = request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        workitem_id = request.query_params.get('workitem_id')
        if workitem_id:
            try:
                task = WorkItem.objects.filter(pk=workitem_id).select_related(
                    'source_content_type'
                ).first()
                q_task = Q(workitem_id=workitem_id)
                if task and task.source_content_type_id:
                    wiki_ct = ContentType.objects.get_for_model(WikiPage)
                    if task.source_content_type_id == wiki_ct.id and task.source_object_id:
                        q_task = q_task | Q(id=task.source_object_id)
                queryset = queryset.filter(q_task)
            except (ValueError, ContentType.DoesNotExist):
                return WikiPage.objects.none()

        # Черновики текущего пользователя в том же scope
        if request.user.is_authenticated:
            user_pages = WikiPage.objects.filter(
                author=request.user,
                is_published=False
            )
            if workspace_id:
                user_pages = user_pages.filter(
                    Q(workspace_id=workspace_id) | Q(project__workspace_id=workspace_id)
                )
            if project_id:
                user_pages = user_pages.filter(project_id=project_id)
            if workitem_id:
                try:
                    task = WorkItem.objects.filter(pk=workitem_id).first()
                    if task and task.source_content_type_id:
                        wiki_ct = ContentType.objects.get_for_model(WikiPage)
                        if task.source_content_type_id == wiki_ct.id and task.source_object_id:
                            user_pages = user_pages.filter(id=task.source_object_id)
                        else:
                            user_pages = WikiPage.objects.none()
                except (ValueError, ContentType.DoesNotExist):
                    user_pages = WikiPage.objects.none()
            queryset = (queryset | user_pages).distinct()

        return select_prefetch(queryset)
    
    def perform_create(self, serializer):
        """Создание Wiki страницы."""
        serializer.save()
    
    @action(detail=False, methods=['get'], url_path='projects/(?P<project_id>[^/.]+)/tree')
    def tree(self, request, project_id=None):
        """Получение дерева Wiki страниц проекта (опубликованные + черновики текущего пользователя)."""
        project = get_object_or_404(Project, pk=project_id)
        q = Q(project=project, parent__isnull=True)
        if request.user.is_authenticated:
            q = q & (Q(is_published=True) | Q(author=request.user))
        else:
            q = q & Q(is_published=True)
        root_pages = WikiPage.objects.filter(q).order_by('order', 'title')
        serializer = WikiPageTreeSerializer(root_pages, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='personal/tree')
    def personal_tree(self, request):
        """Дерево всех блокнотов пользователя для вкладки «Документы»: с привязками и без (корни — parent__isnull=True)."""
        if not request.user.is_authenticated:
            return Response([], status=status.HTTP_200_OK)
        root_pages = WikiPage.objects.filter(
            author=request.user,
            parent__isnull=True,
        ).order_by('order', 'title')
        serializer = WikiPageTreeSerializer(
            root_pages,
            many=True,
            context={'request': request, 'scope': 'personal'},
        )
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='create-task')
    def create_task(self, request, pk=None):
        """Создать задачу из записи (Wiki-страницы). Заголовок и контент → название и описание задачи."""
        page = self.get_object()
        if not page.project_id:
            return Response(
                {'detail': 'Сначала привяжите записку к проекту (PATCH с полем project).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        description = (page.content or '')[:10000]
        task = WorkItem.objects.create(
            title=page.title[:500],
            description=description,
            project=page.project,
            created_by=request.user,
            source_content_type=ContentType.objects.get_for_model(WikiPage),
            source_object_id=page.id,
        )
        serializer = WorkItemSerializer(task, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
