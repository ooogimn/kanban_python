"""
Todo models for Office Suite 360.
"""
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.core.models import User, Workspace


class Project(models.Model):
    """Проект."""
    
    STATUS_PLANNING = 'planning'
    STATUS_ACTIVE = 'active'
    STATUS_ON_HOLD = 'on_hold'
    STATUS_COMPLETED = 'completed'
    STATUS_ARCHIVED = 'archived'
    
    STATUS_CHOICES = [
        (STATUS_PLANNING, _('Planning')),
        (STATUS_ACTIVE, _('Active')),
        (STATUS_ON_HOLD, _('On Hold')),
        (STATUS_COMPLETED, _('Completed')),
        (STATUS_ARCHIVED, _('Archived')),
    ]
    
    name = models.CharField(
        max_length=255,
        verbose_name=_('Name')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PLANNING,
        verbose_name=_('Status')
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='projects',
        verbose_name=_('Workspace')
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='owned_projects',
        verbose_name=_('Owner')
    )
    customer = models.ForeignKey(
        'crm.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='projects',
        verbose_name=_('Customer'),
        help_text=_('Клиент проекта (CRM)')
    )
    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('Start Date')
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('End Date')
    )
    budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Budget')
    )
    budget_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Budget Total'),
        help_text=_('Общий бюджет проекта')
    )
    budget_spent = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name=_('Budget Spent'),
        help_text=_('Сумма расходов по проекту')
    )
    budget_alert_threshold = models.IntegerField(
        default=80,
        verbose_name=_('Budget Alert Threshold (%)'),
        help_text=_('При каком проценте израсходования уведомлять админа')
    )
    hourly_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Hourly Rate'),
        help_text=_('Стоимость часа работы по проекту (для авто-биллинга)')
    )
    # Уровни уведомлений о бюджете (умные алерты — не спамить при каждом списании)
    BUDGET_ALERT_NONE = 0
    BUDGET_ALERT_WARNING = 80
    BUDGET_ALERT_CRITICAL = 100
    BUDGET_ALERT_LEVEL_CHOICES = [
        (BUDGET_ALERT_NONE, _('None')),
        (BUDGET_ALERT_WARNING, _('Warning (80%)')),
        (BUDGET_ALERT_CRITICAL, _('Critical (100%)')),
    ]
    last_budget_alert_level = models.IntegerField(
        choices=BUDGET_ALERT_LEVEL_CHOICES,
        default=BUDGET_ALERT_NONE,
        verbose_name=_('Last Budget Alert Level'),
        help_text=_('Уровень последнего отправленного уведомления о бюджете')
    )
    progress = models.IntegerField(
        default=0,
        verbose_name=_('Progress (%)'),
        help_text=_('0-100, среднее по этапам (Stage), пересчитывается сервисом')
    )
    health_status = models.CharField(
        max_length=20,
        default='on_track',
        verbose_name=_('Health Status'),
        help_text=_('on_track / behind — по этапам проекта')
    )
    logo = models.ImageField(
        upload_to='projects/logos/',
        null=True,
        blank=True,
        verbose_name=_('Logo')
    )
    is_personal = models.BooleanField(
        default=False,
        editable=False,
        verbose_name=_('Is personal project'),
        help_text=_('Личный проект пользователя в личном пространстве; создаётся автоматически')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at')
    )
    
    class Meta:
        verbose_name = 'Проект'
        verbose_name_plural = 'Проекты'
        db_table = 'projects'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'status']),
            models.Index(fields=['owner']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['workspace'],
                condition=models.Q(is_personal=True),
                name='unique_personal_project_per_workspace',
            ),
        ]
    
    def __str__(self):
        return self.name

    def update_budget_stats(self):
        """
        Пересчёт budget_spent и проверка алерта.
        Вызывается сигналами при изменении Transaction или WorkItem.cost.
        """
        try:
            from apps.finance.services import recalc_project_budget
            recalc_project_budget(self)
        except Exception:
            pass
    
    @property
    def balance_info(self):
        """
        Получение информации о балансе проекта (Task 2.2).
        
        Вызывает FinanceService.get_project_balance().
        
        Returns:
            dict: {
                'total_budget': Decimal,
                'spent': Decimal,
                'on_hold': Decimal,
                'available': Decimal
            }
        """
        try:
            from apps.finance.services import FinanceService
            return FinanceService.get_project_balance(self.id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                f"Error getting balance for project {self.id}: {e}"
            )
            return {
                'total_budget': 0,
                'spent': 0,
                'on_hold': 0,
                'available': 0,
            }


class WorkItem(models.Model):
    """Задача/Тикет."""
    
    STATUS_TODO = 'todo'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_REVIEW = 'review'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    
    STATUS_CHOICES = [
        (STATUS_TODO, _('To Do')),
        (STATUS_IN_PROGRESS, _('In Progress')),
        (STATUS_REVIEW, _('Review')),
        (STATUS_COMPLETED, _('Completed')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]
    
    PRIORITY_LOW = 'low'
    PRIORITY_MEDIUM = 'medium'
    PRIORITY_HIGH = 'high'
    PRIORITY_URGENT = 'urgent'
    
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, _('Low')),
        (PRIORITY_MEDIUM, _('Medium')),
        (PRIORITY_HIGH, _('High')),
        (PRIORITY_URGENT, _('Urgent')),
    ]
    
    # Статусы уведомлений о дедлайнах (для heartbeat/alerts)
    ALERT_NONE = 'none'
    ALERT_48H = '48h'
    ALERT_24H = '24h'
    ALERT_OVERDUE = 'overdue'
    
    ALERT_CHOICES = [
        (ALERT_NONE, _('None')),
        (ALERT_48H, _('48 hours')),
        (ALERT_24H, _('24 hours')),
        (ALERT_OVERDUE, _('Overdue')),
    ]
    
    title = models.CharField(
        max_length=500,
        verbose_name=_('Title')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_TODO,
        verbose_name=_('Status')
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default=PRIORITY_MEDIUM,
        verbose_name=_('Priority')
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('Due Date')
    )
    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('Start Date')
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Completed At')
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Started At'),
        help_text=_('Фактическое время первого перевода в «В работе» (для анализа «в графике»)')
    )
    progress = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name=_('Progress (%)')
    )
    estimated_hours = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Estimated Hours')
    )
    actual_hours = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Actual Hours')
    )
    time_estimate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Time Estimate (hours)'),
        help_text=_('Оценка времени в часах')
    )
    time_spent = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Time Spent (hours)'),
        help_text=_('Затрачено времени в часах')
    )
    cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Cost'),
        help_text=_('Себестоимость/расход на выполнение задачи')
    )
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Price'),
        help_text=_('Цена для клиента (если отличается от cost)')
    )
    is_billable = models.BooleanField(
        default=True,
        verbose_name=_('Is Billable'),
        help_text=_('Выставлять ли счет клиенту за эту задачу')
    )
    stage = models.ForeignKey(
        'kanban.Stage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workitems',
        verbose_name=_('Stage'),
        help_text=_('Этап (канбан), на котором отображается задача')
    )
    kanban_column = models.ForeignKey(
        'kanban.Column',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workitems_direct',
        verbose_name=_('Kanban Column'),
        help_text=_('Текущая колонка канбана')
    )
    responsible = models.ForeignKey(
        'core.ProjectMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_workitems',
        verbose_name=_('Responsible'),
        help_text=_('Ответственный (реальный участник или теневой сотрудник)')
    )
    sort_order = models.IntegerField(
        default=0,
        verbose_name=_('Sort Order'),
        help_text=_('Порядок внутри колонки на общей доске')
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='tasks',
        null=True,
        blank=True,
        verbose_name=_('Project')
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_tasks',
        verbose_name=_('Created By')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at')
    )
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Deleted at')
    )
    version = models.IntegerField(
        default=1,
        verbose_name=_('Version')
    )
    
    # Источник задачи: запись (WikiPage) или комментарий (Comment)
    source_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workitem_sources',
        verbose_name=_('Source Content Type')
    )
    source_object_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name=_('Source Object ID')
    )
    source_object = GenericForeignKey('source_content_type', 'source_object_id')
    
    # Поля для heartbeat/alerts (Task 1.2)
    deadline_notification_sent = models.CharField(
        max_length=20,
        choices=ALERT_CHOICES,
        default=ALERT_NONE,
        verbose_name=_('Deadline Notification Status'),
        help_text=_('Статус последнего отправленного уведомления о дедлайне')
    )
    time_alert_sent = models.BooleanField(
        default=False,
        verbose_name=_('Time Overrun Alert Sent'),
        help_text=_('Флаг: уведомление о перерасходе времени отправлено')
    )
    color = models.CharField(
        max_length=7,
        null=True,
        blank=True,
        verbose_name=_('Color'),
        help_text=_('Hex color for task card (Imperial Illumination)')
    )
    
    # M2M relationships
    assigned_to = models.ManyToManyField(
        User,
        related_name='assigned_tasks',
        blank=True,
        verbose_name=_('Assigned To'),
        help_text=_('Deprecated: предпочтительно использовать responsible (ProjectMember).')
    )
    watchers = models.ManyToManyField(
        User,
        related_name='watched_tasks',
        blank=True,
        verbose_name=_('Watchers')
    )
    tags = models.ManyToManyField(
        'documents.Tag',
        related_name='tasks',
        blank=True,
        verbose_name=_('Tags')
    )
    dependencies = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='dependent_tasks',
        verbose_name=_('Dependencies')
    )
    
    class Meta:
        verbose_name = 'Задача'
        verbose_name_plural = 'Задачи'
        db_table = 'work_items'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['due_date']),
            models.Index(fields=['project']),
            models.Index(fields=['stage']),
            models.Index(fields=['created_at']),
            models.Index(fields=['priority', 'status']),
            models.Index(fields=['source_content_type', 'source_object_id']),
        ]
    
    def __str__(self):
        return self.title
    
    @property
    def is_deleted(self):
        """Проверка, удалена ли задача (soft delete)."""
        return self.deleted_at is not None


class ChecklistItem(models.Model):
    """Подзадача (чек-лист) для WorkItem. Управляет прогрессом и статусом основной задачи."""

    workitem = models.ForeignKey(
        WorkItem,
        on_delete=models.CASCADE,
        related_name='checklist_items',
        verbose_name=_('Work Item'),
    )
    title = models.CharField(
        max_length=500,
        verbose_name=_('Title'),
    )
    is_done = models.BooleanField(
        default=False,
        verbose_name=_('Is Done'),
    )
    sort_order = models.IntegerField(
        default=0,
        verbose_name=_('Sort Order'),
    )

    class Meta:
        verbose_name = 'Пункт чек-листа'
        verbose_name_plural = 'Пункты чек-листа'
        db_table = 'checklist_items'
        ordering = ['sort_order', 'id']
        indexes = [
            models.Index(fields=['workitem']),
        ]

    def __str__(self):
        return self.title[:50] or str(self.id)


class TaskDependency(models.Model):
    """
    Зависимость задач (Finish-to-Start) для Умного Ганта.
    predecessor должен закончиться до начала successor.
    """
    TYPE_FS = 'FS'
    TYPE_SS = 'SS'
    TYPE_FF = 'FF'
    TYPE_SF = 'SF'
    TYPE_CHOICES = [
        (TYPE_FS, _('Finish-to-Start')),
        (TYPE_SS, _('Start-to-Start')),
        (TYPE_FF, _('Finish-to-Finish')),
        (TYPE_SF, _('Start-to-Finish')),
    ]

    predecessor = models.ForeignKey(
        WorkItem,
        on_delete=models.CASCADE,
        related_name='successors',
        verbose_name=_('Predecessor'),
    )
    successor = models.ForeignKey(
        WorkItem,
        on_delete=models.CASCADE,
        related_name='predecessors',
        verbose_name=_('Successor'),
    )
    type = models.CharField(
        max_length=2,
        choices=TYPE_CHOICES,
        default=TYPE_FS,
        verbose_name=_('Type'),
    )
    lag_days = models.IntegerField(
        default=0,
        verbose_name=_('Lag (days)'),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at'),
    )

    class Meta:
        verbose_name = 'Зависимость задач'
        verbose_name_plural = 'Зависимости задач'
        db_table = 'task_dependencies'
        unique_together = [['predecessor', 'successor']]
        indexes = [
            models.Index(fields=['predecessor', 'successor']),
        ]

    def __str__(self):
        return f"{self.predecessor_id} -> {self.successor_id} ({self.type})"
