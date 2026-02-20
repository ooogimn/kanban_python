"""
Views for todo app.
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.utils.text import slugify
from .models import Project, WorkItem, ChecklistItem
from .serializers import (
    ProjectSerializer,
    WorkItemSerializer,
    WorkItemListSerializer,
    ChecklistItemSerializer,
)
from apps.auth.permissions import IsWorkspaceMember
from apps.core.models import Workspace, WorkspaceMember
from apps.notifications.mixins import AuditUserMixin
from apps.notifications.audit import log_audit
from apps.notifications.models import AuditLog


class ProjectViewSet(AuditUserMixin, viewsets.ModelViewSet):
    """
    ViewSet для управления проектами.
    """
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsWorkspaceMember]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'workspace', 'owner']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'name', 'start_date', 'end_date']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Фильтрация по workspace пользователя; для staff без членства — все workspace (восстановление доступа)."""
        user = self.request.user
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list(
                'workspace_id', flat=True
            )
        )
        if not workspace_ids and getattr(user, 'is_staff', False):
            workspace_ids = list(Workspace.objects.values_list('id', flat=True))
        queryset = super().get_queryset().filter(workspace_id__in=workspace_ids) if workspace_ids else super().get_queryset().none()
        workspace_id = self.request.query_params.get('workspace_id')
        if workspace_id and workspace_ids:
            try:
                wid = int(workspace_id)
                if wid in workspace_ids:
                    queryset = queryset.filter(workspace_id=wid)
            except (ValueError, TypeError):
                pass
        return queryset.select_related('workspace', 'owner').prefetch_related('members')
    
    def create(self, request, *args, **kwargs):
        """При создании подставляем workspace пользователя, если не передан или не найден.
        Если у пользователя нет workspace, создаем его автоматически.
        """
        data = dict(request.data) if request.data else {}
        workspace_id = data.get('workspace')
        
        # Получаем workspace пользователя
        membership = WorkspaceMember.objects.filter(user=request.user).select_related('workspace').first()
        
        if not workspace_id:
            # Если workspace не передан, используем первый доступный или создаем новый
            if not membership:
                # Создаем workspace для пользователя
                workspace_name = f"Workspace {request.user.username}"
                workspace_slug = slugify(workspace_name)
                # Убеждаемся, что slug уникален
                counter = 1
                base_slug = workspace_slug
                while Workspace.objects.filter(slug=workspace_slug).exists():
                    workspace_slug = f"{base_slug}-{counter}"
                    counter += 1
                
                workspace = Workspace.objects.create(
                    name=workspace_name,
                    slug=workspace_slug,
                    description=f"Личное рабочее пространство пользователя {request.user.username}"
                )
                # Добавляем пользователя как owner
                membership = WorkspaceMember.objects.create(
                    workspace=workspace,
                    user=request.user,
                    role=WorkspaceMember.ROLE_OWNER
                )
            data['workspace'] = membership.workspace_id
        else:
            # Проверяем, что пользователь в этом workspace
            try:
                WorkspaceMember.objects.get(workspace_id=workspace_id, user=request.user)
            except WorkspaceMember.DoesNotExist:
                # Если пользователь не в указанном workspace, используем его первый workspace
                if membership:
                    data['workspace'] = membership.workspace_id
                else:
                    # Создаем workspace для пользователя
                    workspace_name = f"Workspace {request.user.username}"
                    workspace_slug = slugify(workspace_name)
                    counter = 1
                    base_slug = workspace_slug
                    while Workspace.objects.filter(slug=workspace_slug).exists():
                        workspace_slug = f"{base_slug}-{counter}"
                        counter += 1
                    
                    workspace = Workspace.objects.create(
                        name=workspace_name,
                        slug=workspace_slug,
                        description=f"Личное рабочее пространство пользователя {request.user.username}"
                    )
                    membership = WorkspaceMember.objects.create(
                        workspace=workspace,
                        user=request.user,
                        role=WorkspaceMember.ROLE_OWNER
                    )
                    data['workspace'] = workspace.id

        # Личный аккаунт: в личном пространстве уже есть один проект, создавать второй нельзя
        from apps.core.services import get_default_workspace_and_project
        default_ws, _ = get_default_workspace_and_project(request.user)
        if default_ws and int(data.get('workspace', 0)) == default_ws.id:
            return Response(
                {'detail': 'У личного аккаунта один проект создаётся автоматически. Перейдите на бизнес-тариф для создания дополнительных проектов.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        """Установка owner при создании."""
        serializer.save(owner=self.request.user)
    
    def update(self, request, *args, **kwargs):
        """Обновление проекта с поддержкой multipart/form-data для логотипа."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Если это multipart/form-data, данные приходят в request.data
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        
        return Response(serializer.data)


class WorkItemViewSet(AuditUserMixin, viewsets.ModelViewSet):
    """
    ViewSet для управления задачами (WorkItem).
    """
    queryset = WorkItem.objects.filter(deleted_at__isnull=True)
    permission_classes = [IsWorkspaceMember]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'project', 'due_date']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'due_date', 'priority', 'status']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Выбор сериализатора в зависимости от действия."""
        if self.action == 'list':
            return WorkItemListSerializer
        return WorkItemSerializer
    
    def get_queryset(self):
        """Фильтрация задач: только из workspace, где пользователь участник."""
        queryset = super().get_queryset()
        user = self.request.user
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        if not workspace_ids and getattr(user, 'is_staff', False):
            workspace_ids = list(Workspace.objects.values_list('id', flat=True))
        my_tasks = Q(created_by=user) | Q(assigned_to=user)
        if workspace_ids:
            # Задачи из workspace ИЛИ без проекта (если это моя задача)
            queryset = queryset.filter(
                Q(project__workspace_id__in=workspace_ids)
                | (Q(project__isnull=True) & my_tasks)
            )
        else:
            # Нет workspace (например, только зарегистрировался) — показываем только свои задачи без проекта
            queryset = queryset.filter(Q(project__isnull=True) & my_tasks)

        # Только свои: созданные пользователем или где он назначен ответственным
        queryset = queryset.filter(my_tasks)

        # Фильтр по проекту
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        # Фильтр по исполнителю
        assigned_to = self.request.query_params.get('assigned_to')
        if assigned_to:
            queryset = queryset.filter(assigned_to__id=assigned_to)
        
        # Фильтр по дедлайну
        due_date_before = self.request.query_params.get('due_date_before')
        if due_date_before:
            queryset = queryset.filter(due_date__lte=due_date_before)
        
        due_date_after = self.request.query_params.get('due_date_after')
        if due_date_after:
            queryset = queryset.filter(due_date__gte=due_date_after)
        
        return queryset.select_related(
            'project', 'created_by'
        ).prefetch_related(
            'assigned_to', 'watchers', 'tags', 'dependencies', 'checklist_items'
        ).distinct()
    
    def perform_create(self, serializer):
        """Установка created_by при создании."""
        serializer.save(created_by=self.request.user)
    
    def perform_destroy(self, instance):
        """Soft delete вместо физического удаления."""
        log_audit(
            AuditLog.ACTION_DELETE, 'workitem', instance.id,
            user=self.request.user,
            changes={'title': instance.title},
        )
        instance.deleted_at = timezone.now()
        instance._skip_signal = True
        instance.save(update_fields=['deleted_at', 'updated_at'])
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Завершение задачи: все подзадачи помечаются выполненными, progress = 100."""
        workitem = self.get_object()
        from .services.checklist_service import complete_checklist_for_workitem
        complete_checklist_for_workitem(workitem)
        workitem.status = WorkItem.STATUS_COMPLETED
        workitem.completed_at = timezone.now()
        workitem.progress = 100
        workitem._skip_signal = True
        workitem.save(update_fields=['status', 'completed_at', 'progress', 'updated_at'])
        serializer = self.get_serializer(workitem)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Отмена задачи."""
        workitem = self.get_object()
        workitem.status = WorkItem.STATUS_CANCELLED
        workitem.save()
        serializer = self.get_serializer(workitem)
        return Response(serializer.data)


class ChecklistItemViewSet(viewsets.ModelViewSet):
    """CRUD подзадач (чек-лист) для WorkItem."""

    queryset = ChecklistItem.objects.all()
    serializer_class = ChecklistItemSerializer
    permission_classes = [IsWorkspaceMember]

    def get_queryset(self):
        user = self.request.user
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        if not workspace_ids and getattr(user, 'is_staff', False):
            workspace_ids = list(Workspace.objects.values_list('id', flat=True))
        my_tasks = Q(workitem__created_by=user) | Q(workitem__assigned_to=user)
        if workspace_ids:
            qs = super().get_queryset().select_related('workitem', 'workitem__project').filter(
                workitem__deleted_at__isnull=True,
            ).filter(
                Q(workitem__project__workspace_id__in=workspace_ids)
                | (Q(workitem__project__isnull=True) & my_tasks)
            )
        else:
            qs = super().get_queryset().select_related('workitem', 'workitem__project').filter(
                workitem__deleted_at__isnull=True,
                workitem__project__isnull=True,
            ).filter(my_tasks)
        workitem_id = self.request.query_params.get('workitem_id')
        if workitem_id:
            qs = qs.filter(workitem_id=workitem_id)
        return qs.order_by('sort_order', 'id')
