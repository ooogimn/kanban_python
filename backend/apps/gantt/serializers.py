"""
Serializers for gantt app.
"""
from rest_framework import serializers
from .models import GanttTask, GanttDependency
from apps.todo.models import TaskDependency, WorkItem


# --- API для DHTMLX Gantt / визуализации ---

class GanttTaskSerializer(serializers.Serializer):
    """
    Упрощённая версия WorkItem/GanttTask для DHTMLX Gantt.
    Поля: id, text, start_date, end_date, progress, parent.
    """
    id = serializers.IntegerField()
    text = serializers.CharField()
    start_date = serializers.DateField(format='%Y-%m-%d')
    end_date = serializers.DateField(format='%Y-%m-%d')
    progress = serializers.IntegerField(default=0)
    parent = serializers.IntegerField(allow_null=True, required=False)

    @staticmethod
    def from_gantt_task(task):
        """Создание из GanttTask. Progress из WorkItem (чек-лист). Color из WorkItem (Imperial). sprint_name для фильтров."""
        progress = task.progress or 0
        color = '#fbbf24'
        sprint_name = None
        actual_start = None
        actual_end = None
        if task.related_workitem_id:
            wi = task.related_workitem
            progress = wi.progress or progress
            if wi.color:
                color = wi.color
            if getattr(wi, 'stage', None):
                sprint_name = wi.stage.name
            if getattr(wi, 'started_at', None):
                actual_start = wi.started_at.date().isoformat() if hasattr(wi.started_at, 'date') else str(wi.started_at)[:10]
            if getattr(wi, 'completed_at', None):
                actual_end = wi.completed_at.date().isoformat() if hasattr(wi.completed_at, 'date') else str(wi.completed_at)[:10]
        out = {
            'id': task.id,
            'text': task.name,
            'start_date': task.start_date,
            'end_date': task.end_date,
            'progress': progress,
            'parent': task.parent_id or 0,
            'color': color,
        }
        if sprint_name is not None:
            out['sprint_name'] = sprint_name
        if actual_start is not None:
            out['actual_start'] = actual_start
        if actual_end is not None:
            out['actual_end'] = actual_end
        return out


class GanttLinkSerializer(serializers.Serializer):
    """
    Сериализатор связей (dependencies) для DHTMLX Gantt.
    Формат: id, source (predecessor), target (successor), type (1=FS, 2=SS, 3=FF, 4=SF).
    """
    id = serializers.IntegerField()
    source = serializers.IntegerField()  # predecessor task id
    target = serializers.IntegerField()  # successor task id
    type = serializers.IntegerField()    # 1=FS, 2=SS, 3=FF, 4=SF

    TYPE_MAP = {
        'FS': 1,
        'SS': 2,
        'FF': 3,
        'SF': 4,
    }

    @classmethod
    def from_gantt_dependency(cls, dep):
        """Создание из GanttDependency."""
        return {
            'id': dep.id,
            'source': dep.predecessor_id,
            'target': dep.successor_id,
            'type': cls.TYPE_MAP.get(dep.type, 1),
        }


class GanttTaskFullSerializer(serializers.ModelSerializer):
    """Полный сериализатор для GanttTask (CRUD). Progress и color из WorkItem (чек-лист, Imperial)."""
    
    related_workitem_title = serializers.CharField(
        source='related_workitem.title',
        read_only=True
    )
    parent_name = serializers.CharField(
        source='parent.name',
        read_only=True
    )
    progress = serializers.SerializerMethodField()
    color = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()
    dependencies = serializers.SerializerMethodField()
    
    class Meta:
        model = GanttTask
        fields = [
            'id', 'name', 'start_date', 'end_date', 'progress', 'color',
            'related_workitem', 'related_workitem_title', 'parent',
            'parent_name', 'children', 'dependencies', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_progress(self, obj):
        """Progress из WorkItem (чек-лист) если есть."""
        if obj.related_workitem_id:
            return obj.related_workitem.progress or obj.progress or 0
        return obj.progress or 0

    def get_color(self, obj):
        """Цвет из WorkItem (Imperial Palette)."""
        if obj.related_workitem_id and obj.related_workitem.color:
            return obj.related_workitem.color
        return '#fbbf24'
    
    def get_children(self, obj):
        """Получение дочерних задач."""
        children = obj.children.all()
        return [GanttTaskSerializer.from_gantt_task(c) for c in children]
    
    def get_dependencies(self, obj):
        """Получение зависимостей из TaskDependency (где obj — successor)."""
        if not obj.related_workitem_id:
            return []
        deps = TaskDependency.objects.filter(successor=obj.related_workitem).select_related(
            'predecessor', 'successor'
        )
        result = []
        for dep in deps:
            fmt = task_dependency_to_gantt_format(dep)
            if fmt:
                result.append(fmt)
        return result


class GanttDependencySerializer(serializers.ModelSerializer):
    """Сериализатор для GanttDependency."""
    
    predecessor_name = serializers.CharField(
        source='predecessor.name',
        read_only=True
    )
    successor_name = serializers.CharField(
        source='successor.name',
        read_only=True
    )
    
    class Meta:
        model = GanttDependency
        fields = [
            'id', 'predecessor', 'predecessor_name', 'successor',
            'successor_name', 'type', 'lag', 'created_at'
        ]
        read_only_fields = ['created_at']


class GanttProjectSerializer(serializers.Serializer):
    """Сериализатор для проекта с задачами Ганта."""
    
    project_id = serializers.IntegerField()
    project_name = serializers.CharField()
    tasks = GanttTaskFullSerializer(many=True)
    dependencies = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        help_text='Зависимости (TaskDependency) в формате для отрисовки стрелок',
    )


class GanttDataSerializer(serializers.Serializer):
    """
    Формат данных для DHTMLX Gantt: { data: [], links: [] }.
    """
    data = serializers.ListField(child=GanttTaskSerializer())
    links = serializers.ListField(child=GanttLinkSerializer())


# --- TaskDependency (STEP 4: Умный Гант) ---

def task_dependency_to_gantt_format(dep):
    """Маппинг TaskDependency (WorkItem) в формат для Ганта (GanttTask IDs)."""
    try:
        pred_gt = dep.predecessor.gantt_task
        succ_gt = dep.successor.gantt_task
    except (GanttTask.DoesNotExist, WorkItem.DoesNotExist):
        return None
    return {
        'id': dep.id,
        'predecessor': pred_gt.id,
        'predecessor_name': pred_gt.name,
        'successor': succ_gt.id,
        'successor_name': succ_gt.name,
        'type': dep.type,
        'lag': dep.lag_days,
        'created_at': dep.created_at.isoformat() if dep.created_at else None,
    }


class TaskDependencySerializer(serializers.Serializer):
    """
    API для TaskDependency. Принимает predecessor/successor как GanttTask IDs.
    Возвращает в формате для отрисовки стрелок (predecessor, successor = GanttTask IDs).
    """
    id = serializers.IntegerField(read_only=True)
    predecessor = serializers.IntegerField(help_text='GanttTask ID')
    successor = serializers.IntegerField(help_text='GanttTask ID')
    type = serializers.ChoiceField(
        choices=[('FS', 'FS'), ('SS', 'SS'), ('FF', 'FF'), ('SF', 'SF')],
        default='FS'
    )
    lag_days = serializers.IntegerField(default=0, required=False)
    predecessor_name = serializers.CharField(read_only=True, required=False)
    successor_name = serializers.CharField(read_only=True, required=False)
    lag = serializers.IntegerField(read_only=True, required=False)
    created_at = serializers.DateTimeField(read_only=True, required=False)

    def validate(self, attrs):
        pred_gt_id = attrs.get('predecessor')
        succ_gt_id = attrs.get('successor')
        if pred_gt_id == succ_gt_id:
            raise serializers.ValidationError(
                {'successor': 'Предшественник и преемник не могут совпадать'}
            )
        try:
            pred_gt = GanttTask.objects.select_related('related_workitem').get(pk=pred_gt_id)
        except GanttTask.DoesNotExist:
            raise serializers.ValidationError(
                {'predecessor': 'GanttTask не найден'}
            )
        try:
            succ_gt = GanttTask.objects.select_related('related_workitem').get(pk=succ_gt_id)
        except GanttTask.DoesNotExist:
            raise serializers.ValidationError(
                {'successor': 'GanttTask не найден'}
            )
        if not pred_gt.related_workitem_id or not succ_gt.related_workitem_id:
            raise serializers.ValidationError(
                {'predecessor': 'Задачи должны быть связаны с WorkItem для зависимостей'}
            )
        pred_wi_id = pred_gt.related_workitem_id
        succ_wi_id = succ_gt.related_workitem_id
        from apps.gantt.services import check_cycle
        if check_cycle(pred_wi_id, succ_wi_id):
            raise serializers.ValidationError(
                {'successor': 'Создание зависимости приведёт к циклической ссылке'}
            )
        if TaskDependency.objects.filter(predecessor_id=pred_wi_id, successor_id=succ_wi_id).exists():
            raise serializers.ValidationError(
                {'successor': 'Такая зависимость уже существует'}
            )
        attrs['_pred_wi'] = pred_gt.related_workitem
        attrs['_succ_wi'] = succ_gt.related_workitem
        attrs['_pred_gt'] = pred_gt
        attrs['_succ_gt'] = succ_gt
        return attrs

    def create(self, validated_data):
        pred_wi = validated_data['_pred_wi']
        succ_wi = validated_data['_succ_wi']
        dep_type = validated_data.get('type', 'FS')
        lag_days = validated_data.get('lag_days', 0)
        dep = TaskDependency.objects.create(
            predecessor=pred_wi,
            successor=succ_wi,
            type=dep_type,
            lag_days=lag_days,
        )
        # Сохраняем GanttTask в instance для надёжного to_representation (маппинг после создания)
        dep._pred_gt = validated_data.get('_pred_gt')
        dep._succ_gt = validated_data.get('_succ_gt')
        return dep

    def to_representation(self, instance):
        pred_gt = getattr(instance, '_pred_gt', None)
        succ_gt = getattr(instance, '_succ_gt', None)
        if pred_gt is not None and succ_gt is not None:
            d = {
                'id': instance.id,
                'predecessor': pred_gt.id,
                'predecessor_name': pred_gt.name,
                'successor': succ_gt.id,
                'successor_name': succ_gt.name,
                'type': instance.type,
                'lag': instance.lag_days,
                'lag_days': instance.lag_days,
                'created_at': instance.created_at.isoformat() if instance.created_at else None,
            }
            return d
        d = task_dependency_to_gantt_format(instance)
        if d is None:
            return {}
        d['lag'] = instance.lag_days
        d['lag_days'] = instance.lag_days
        return d
