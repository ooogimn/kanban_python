"""
Serializers for kanban app.
Канбан — представление WorkItem. Модель Card удалена.
"""
from rest_framework import serializers
from apps.core.models import User
from apps.todo.models import WorkItem
from .models import Stage, Board, Column


# --- API для визуализации (WorkItem как карточки) ---

class WorkItemShortSerializer(serializers.Serializer):
    """Краткие данные WorkItem для отображения на канбане."""
    id = serializers.IntegerField()
    title = serializers.CharField()
    cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    priority = serializers.CharField(required=False)
    due_date = serializers.DateField(required=False, allow_null=True)
    start_date = serializers.DateField(required=False, allow_null=True)
    completed_at = serializers.DateTimeField(required=False, allow_null=True)
    started_at = serializers.DateTimeField(required=False, allow_null=True)
    status = serializers.CharField(required=False)
    sort_order = serializers.IntegerField(required=False, default=0)
    color = serializers.CharField(required=False, allow_null=True)
    executor_avatar = serializers.SerializerMethodField()
    responsible_name = serializers.SerializerMethodField()
    checklist_stats = serializers.SerializerMethodField()

    def get_checklist_stats(self, obj):
        """Статистика чек-листа для прогресс-бара на карточке: {total, done}."""
        items = getattr(obj, 'checklist_items', None)
        if items is None:
            return {'total': 0, 'done': 0}
        if hasattr(items, 'all'):
            items = list(items.all())
        total = len(items)
        done = sum(1 for i in items if i.is_done)
        return {'total': total, 'done': done}

    def get_executor_avatar(self, obj):
        """URL аватара первого назначенного исполнителя."""
        assigned = obj.assigned_to.first()
        if assigned and assigned.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(assigned.avatar.url)
            return assigned.avatar.url if hasattr(assigned.avatar, 'url') else None
        return None

    def get_responsible_name(self, obj):
        """Имя ответственного (ProjectMember.display_name или User)."""
        if not getattr(obj, 'responsible_id', None):
            return None
        responsible = getattr(obj, 'responsible', None)
        if responsible is None:
            return None
        return getattr(responsible, 'display_name', None) or (str(responsible.user) if getattr(responsible, 'user', None) else str(responsible))


def _validate_system_columns_order(instance, new_position):
    """
    Проверяет, что после установки instance.position = new_position порядок системных
    колонок этапа остаётся: В плане → В работе → Завершено (plan < in_progress < done).
    """
    columns = list(
        Column.objects.filter(stage_id=instance.stage_id).values_list('id', 'position', 'system_type')
    )
    # (position, id) для стабильной сортировки; для текущей колонки подставляем new_position
    ordered = [
        (new_position if cid == instance.id else pos, cid, stype)
        for cid, pos, stype in columns
    ]
    ordered.sort(key=lambda x: (x[0], x[1]))
    types_in_order = [stype for _, _, stype in ordered]
    idx_plan = next((i for i, t in enumerate(types_in_order) if t == Column.SYSTEM_TYPE_PLAN), None)
    idx_in_progress = next(
        (i for i, t in enumerate(types_in_order) if t == Column.SYSTEM_TYPE_IN_PROGRESS), None
    )
    idx_done = next((i for i, t in enumerate(types_in_order) if t == Column.SYSTEM_TYPE_DONE), None)
    if idx_plan is not None and idx_in_progress is not None and idx_plan >= idx_in_progress:
        raise serializers.ValidationError(
            {'position': 'Порядок обязательных колонок (В плане, В работе, Завершено) должен сохраняться.'}
        )
    if idx_in_progress is not None and idx_done is not None and idx_in_progress >= idx_done:
        raise serializers.ValidationError(
            {'position': 'Порядок обязательных колонок (В плане, В работе, Завершено) должен сохраняться.'}
        )
    if idx_plan is not None and idx_done is not None and idx_plan >= idx_done:
        raise serializers.ValidationError(
            {'position': 'Порядок обязательных колонок (В плане, В работе, Завершено) должен сохраняться.'}
        )


class KanbanColumnSerializer(serializers.ModelSerializer):
    """
    Сериализатор колонки для API визуализации.
    Поля: id, name, order, project, wip_limit, stage, color, system_type. Принимает board= для обратной совместимости.
    """
    order = serializers.IntegerField(source='position', required=False, default=0)
    position = serializers.IntegerField(write_only=True, required=False, default=0)
    project = serializers.PrimaryKeyRelatedField(
        source='stage.project',
        read_only=True
    )
    board = serializers.PrimaryKeyRelatedField(queryset=Stage.objects.all(), write_only=True, required=False)

    class Meta:
        model = Column
        fields = ['id', 'name', 'order', 'position', 'project', 'wip_limit', 'stage', 'board', 'color', 'system_type']
        extra_kwargs = {'stage': {'required': False}, 'system_type': {'read_only': True}}

    def create(self, validated_data):
        validated_data.pop('order', None)
        board = validated_data.pop('board', None)
        if board is not None:
            validated_data['stage'] = board
        pos = validated_data.pop('position', 0)
        validated_data['position'] = pos
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('order', None)
        if 'position' in validated_data:
            new_position = validated_data.pop('position')
            _validate_system_columns_order(instance, new_position)
            instance.position = new_position
        return super().update(instance, validated_data)


class KanbanColumnWithWorkItemsSerializer(serializers.ModelSerializer):
    """Колонка со списком WorkItem (items)."""
    order = serializers.IntegerField(source='position', read_only=True)
    project = serializers.PrimaryKeyRelatedField(
        source='stage.project',
        read_only=True
    )
    items = serializers.SerializerMethodField()
    system_type = serializers.CharField(read_only=True)

    class Meta:
        model = Column
        fields = ['id', 'name', 'order', 'project', 'wip_limit', 'color', 'system_type', 'items']

    def get_items(self, obj):
        """WorkItem в колонке: только задачи этого спринта (stage_id = колонка.stage)."""
        workitems = obj.workitems_direct.filter(
            deleted_at__isnull=True,
            stage_id=obj.stage_id,
        ).select_related('responsible').order_by('sort_order', 'id')
        return WorkItemShortSerializer(workitems, many=True, context=self.context).data


class KanbanBoardSerializer(serializers.ModelSerializer):
    """
    Сериализатор этапа (доски) для API визуализации.
    Возвращает список колонок, внутри каждой — список WorkItem (items).
    """
    columns = KanbanColumnWithWorkItemsSerializer(many=True, read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    progress = serializers.IntegerField(read_only=True)
    health_status = serializers.CharField(read_only=True)

    class Meta:
        model = Stage
        fields = [
            'id', 'name', 'project', 'project_name', 'is_default',
            'progress', 'health_status',
            'columns', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


# --- Базовые сериализаторы ---

class UserBasicSerializer(serializers.ModelSerializer):
    """Базовый сериализатор для User."""

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class ColumnSerializer(serializers.ModelSerializer):
    """Сериализатор для Column."""

    workitems_count = serializers.SerializerMethodField()
    board = serializers.PrimaryKeyRelatedField(source='stage', read_only=True)
    order = serializers.IntegerField(source='position', read_only=True)

    class Meta:
        model = Column
        fields = [
            'id', 'name', 'column_type', 'system_type', 'position', 'order', 'stage', 'board', 'wip_limit',
            'color', 'workitems_count', 'created_at'
        ]
        read_only_fields = ['created_at']

    def get_workitems_count(self, obj):
        return obj.workitems_direct.filter(deleted_at__isnull=True).count()


class BoardSerializer(serializers.ModelSerializer):
    """Сериализатор для Stage (доски). Board = Stage. Без project — подставляем личный проект."""

    project_name = serializers.CharField(source='project.name', read_only=True)
    columns = ColumnSerializer(many=True, read_only=True)
    progress = serializers.IntegerField(read_only=True)
    health_status = serializers.CharField(read_only=True)

    class Meta:
        model = Stage
        fields = [
            'id', 'name', 'project', 'project_name', 'is_default',
            'progress', 'health_status',
            'columns', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        if not validated_data.get('project'):
            request = self.context.get('request')
            if request and request.user:
                from apps.core.services import get_default_workspace_and_project
                _, default_proj = get_default_workspace_and_project(request.user)
                if default_proj:
                    validated_data['project'] = default_proj
        return super().create(validated_data)


class BoardFullSerializer(serializers.ModelSerializer):
    """Полный сериализатор для Stage: колонки с WorkItem (items) + задачи проекта не на этой доске (для синхронизации с Гантом)."""

    columns = KanbanColumnWithWorkItemsSerializer(many=True, read_only=True)
    unplaced_items = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True)
    progress = serializers.IntegerField(read_only=True)
    health_status = serializers.CharField(read_only=True)

    class Meta:
        model = Stage
        fields = [
            'id', 'name', 'project', 'project_name', 'is_default',
            'progress', 'health_status', 'columns', 'unplaced_items',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_unplaced_items(self, obj):
        """Нераспределённые задачи только этого спринта: stage_id=доска, но нет колонки (или колонка не из этой доски)."""
        if not obj.project_id:
            return []
        column_ids = list(obj.columns.values_list('id', flat=True))
        qs = WorkItem.objects.filter(
            stage_id=obj.id,
            deleted_at__isnull=True,
        ).exclude(kanban_column_id__in=column_ids)
        qs = qs.select_related('responsible').prefetch_related('checklist_items', 'assigned_to').order_by('id')
        return WorkItemShortSerializer(qs, many=True, context=self.context).data
