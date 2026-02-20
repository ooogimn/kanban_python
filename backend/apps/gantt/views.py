"""
Views for gantt app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import GanttTask, GanttDependency
from .serializers import (
    GanttTaskSerializer, GanttLinkSerializer,
    GanttTaskFullSerializer, GanttDependencySerializer, GanttProjectSerializer,
    TaskDependencySerializer, task_dependency_to_gantt_format,
)
from apps.todo.models import Project, TaskDependency
from apps.auth.permissions import IsWorkspaceMember


def _gantt_tasks_queryset(request, project_id):
    """
    Задачи Ганта по project_id с фильтрами: sprint_id, user_id, priority.
    - sprint_id: запятая (например 1,2) или "null" — только бэклог (stage_id is null).
    - user_id: responsible_id (ответственный).
    - priority: low, medium, high, urgent.
    """
    qs = GanttTask.objects.filter(
        related_workitem__project_id=project_id,
        related_workitem__deleted_at__isnull=True,
    ).select_related('related_workitem', 'related_workitem__stage', 'parent')

    sprint_id_param = request.query_params.get('sprint_id')
    if sprint_id_param is not None and sprint_id_param.strip().lower() == 'null':
        qs = qs.filter(related_workitem__stage__isnull=True)
    elif sprint_id_param:
        ids = [x.strip() for x in sprint_id_param.split(',') if x.strip() and x.strip().isdigit()]
        if ids:
            qs = qs.filter(related_workitem__stage_id__in=ids)

    user_id = request.query_params.get('user_id')
    if user_id and str(user_id).isdigit():
        qs = qs.filter(related_workitem__responsible_id=int(user_id))

    priority = request.query_params.get('priority')
    if priority and priority.strip():
        qs = qs.filter(related_workitem__priority=priority.strip())

    return qs


class GanttTaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления задачами Ганта.
    При обновлении start_date/end_date/progress синхронизирует с WorkItem (Single Source of Truth).
    """
    queryset = GanttTask.objects.all()
    serializer_class = GanttTaskFullSerializer
    permission_classes = [IsWorkspaceMember]
    
    def get_queryset(self):
        """Фильтрация задач."""
        queryset = super().get_queryset()
        
        # Фильтр по проекту через related_workitem
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(related_workitem__project_id=project_id)
        
        return queryset.select_related(
            'related_workitem', 'parent'
        ).prefetch_related('children', 'predecessor_dependencies', 'successor_dependencies')
    
    def perform_update(self, serializer):
        """После обновления GanttTask синхронизируем даты и прогресс в WorkItem. Сигнал post_save обновит календарь и пересчитает даты преемников."""
        instance = serializer.save()
        if instance.related_workitem_id:
            wi = instance.related_workitem
            wi.start_date = instance.start_date
            wi.due_date = instance.end_date
            wi.progress = instance.progress or 0
            # Не ставим _skip_signal: сигнал task_post_save обновит CalendarEvent (_sync_calendar_event) и вызовет recalculate_dates
            wi.save(update_fields=['start_date', 'due_date', 'progress', 'updated_at'])


class TaskDependencyViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления зависимостями (STEP 4: Умный Гант).
    API принимает predecessor/successor как GanttTask IDs.
    Хранит TaskDependency (WorkItem↔WorkItem) для Auto-Scheduling.
    """
    queryset = TaskDependency.objects.all()
    serializer_class = TaskDependencySerializer
    permission_classes = [IsWorkspaceMember]

    def get_queryset(self):
        """Фильтрация по проекту."""
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project_id')
        if project_id:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(predecessor__project_id=project_id, predecessor__deleted_at__isnull=True)
                | Q(successor__project_id=project_id, successor__deleted_at__isnull=True)
            )
        return queryset.select_related('predecessor', 'successor')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


# Оставляем GanttDependencyViewSet для обратной совместимости (алиас)
GanttDependencyViewSet = TaskDependencyViewSet


class GanttViewSet(viewsets.ViewSet):
    """
    ViewSet для отдачи данных в формате DHTMLX Gantt: { data: [], links: [] }.
    """
    permission_classes = [IsWorkspaceMember]

    def list(self, request):
        """
        GET /api/v1/gantt/?project_id=X
        Возвращает { data: [...], links: [...] } для библиотеки DHTMLX Gantt.
        """
        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response(
                {'error': 'project_id обязателен'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Проект не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

        tasks = _gantt_tasks_queryset(request, project_id)

        # STEP 4: зависимости из TaskDependency (WorkItem), маппинг на GanttTask IDs
        task_deps = TaskDependency.objects.filter(
            Q(predecessor__project_id=project_id, predecessor__deleted_at__isnull=True)
            | Q(successor__project_id=project_id, successor__deleted_at__isnull=True)
        ).select_related('predecessor', 'successor')
        links = []
        for dep in task_deps:
            fmt = task_dependency_to_gantt_format(dep)
            if fmt:
                links.append({
                    'id': fmt['id'],
                    'source': fmt['predecessor'],
                    'target': fmt['successor'],
                    'type': {'FS': 1, 'SS': 2, 'FF': 3, 'SF': 4}.get(fmt['type'], 1),
                })

        data = [GanttTaskSerializer.from_gantt_task(t) for t in tasks]
        return Response({'data': data, 'links': links})

    @action(detail=False, methods=['get'], url_path='projects/(?P<project_id>[^/.]+)/data')
    def project_data(self, request, project_id=None):
        """
        GET /api/v1/gantt/projects/{project_id}/data/
        Формат DHTMLX Gantt: { data: [], links: [] }.
        """
        try:
            Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Проект не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

        tasks = _gantt_tasks_queryset(request, project_id)

        task_deps = TaskDependency.objects.filter(
            predecessor__project_id=project_id,
            predecessor__deleted_at__isnull=True,
        ).select_related('predecessor', 'successor')
        links = []
        for dep in task_deps:
            fmt = task_dependency_to_gantt_format(dep)
            if fmt:
                links.append({
                    'id': fmt['id'],
                    'source': fmt['predecessor'],
                    'target': fmt['successor'],
                    'type': {'FS': 1, 'SS': 2, 'FF': 3, 'SF': 4}.get(fmt['type'], 1),
                })

        data = [GanttTaskSerializer.from_gantt_task(t) for t in tasks]
        return Response({'data': data, 'links': links})

    @action(detail=False, methods=['get'], url_path='projects/(?P<project_id>[^/.]+)/tasks')
    def project_tasks(self, request, project_id=None):
        """
        Получение проекта с задачами Ганта и зависимостями.
        """
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Задачи проекта с фильтрами sprint_id, user_id, priority
        tasks = _gantt_tasks_queryset(request, project_id).prefetch_related('children')
        
        # STEP 4: зависимости из TaskDependency (маппинг на GanttTask IDs)
        task_deps = TaskDependency.objects.filter(
            predecessor__project_id=project_id,
            predecessor__deleted_at__isnull=True,
        ).select_related('predecessor', 'successor')
        dependencies = []
        for dep in task_deps:
            fmt = task_dependency_to_gantt_format(dep)
            if fmt:
                dependencies.append(fmt)

        serializer = GanttProjectSerializer({
            'project_id': project.id,
            'project_name': project.name,
            'tasks': tasks,
            'dependencies': dependencies,
        })
        
        return Response(serializer.data)
