import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'moment/locale/ru';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import { analyticsApi } from '../api/analytics';
import { ganttApi } from '../api/gantt';
import { calendarApi } from '../api/calendar';
import { kanbanApi } from '../api/kanban';
import { coreApi } from '../api/core';
import { mindmapsApi } from '../api/mindmaps';
import { FileList, WikiTree } from '../components/documents';
import { ProjectBudgetWidget } from '../components/widgets';
import { ProjectHeader } from '../components/project';
import ProjectModal from '../components/ProjectModal';
import ProjectChatPanel from '../components/ProjectChatPanel';
import ProjectActivityLog from '../components/ProjectActivityLog';
import ProjectParticipants from '../components/ProjectParticipants';
import TaskModal from '../components/TaskModal';
import GanttChart from '../components/gantt/GanttChart';
import CalendarEventModal from '../components/CalendarEventModal';
import { useProjectWebSocket } from '../hooks/useWebSocket';
import toast from 'react-hot-toast';
import type { CalendarEvent, ProjectMember } from '../types';

moment.locale('ru');
const localizer = momentLocalizer(moment);

const STATUS_LABELS: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

function ProjectMapsTab({ projectId }: { projectId: number }) {
  const { data: maps = [], isLoading } = useQuery({
    queryKey: ['mindmaps', 'project', projectId],
    queryFn: () => mindmapsApi.getList({ project_id: projectId }),
  });
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Ментальные карты проекта</h2>
        <Link
          to={`/mindmaps/new?project_id=${projectId}`}
          className="px-3 py-1.5 rounded-lg bg-imperial-gold text-imperial-bg text-sm font-medium hover:opacity-90"
        >
          Создать карту
        </Link>
      </div>
      {isLoading && <p className="text-slate-500 dark:text-slate-400">Загрузка…</p>}
      <ul className="space-y-2">
        {(maps as { id: number; title: string; updated_at: string }[]).map((m) => (
          <li key={m.id}>
            <Link
              to={`/mindmaps/${m.id}`}
              className="block p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:border-imperial-gold/50 text-slate-900 dark:text-slate-100"
            >
              <span className="font-medium">{m.title}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                {new Date(m.updated_at).toLocaleDateString('ru')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!isLoading && (maps as unknown[]).length === 0 && (
        <p className="text-slate-500 dark:text-slate-400">Нет карт. Создайте первую по кнопке выше.</p>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projectId = id ? Number(id) : 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['overview', 'kanban', 'list', 'gantt', 'calendar', 'files', 'wiki', 'activity', 'members'] as const;
  type TabId = (typeof validTabs)[number];
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    return validTabs.includes((tabFromUrl || '') as TabId) ? (tabFromUrl as TabId) : 'overview';
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarSelectedEvent, setCalendarSelectedEvent] = useState<CalendarEvent | null>(null);
  const [calendarSlotStart, setCalendarSlotStart] = useState<Date | undefined>();
  const [calendarSlotEnd, setCalendarSlotEnd] = useState<Date | undefined>();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberName, setAddMemberName] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('');

  useProjectWebSocket(projectId > 0 ? projectId : null);

  const createMemberMutation = useMutation({
    mutationFn: (data: { project: number; display_name: string; role: string }) =>
      coreApi.createProjectMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setAddMemberOpen(false);
      setAddMemberName('');
      setAddMemberRole('');
      toast.success('Участник добавлен');
    },
    onError: (err: unknown) => {
      const res = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { detail?: string }; status?: number } }).response : undefined;
      const detail = res?.data?.detail;
      const status = res?.status;
      const data = res?.data;
      const firstField = data && typeof data === 'object' && !Array.isArray(data) && typeof detail !== 'string'
        ? Object.entries(data).filter(([k]) => k !== 'detail').map(([, v]) => (Array.isArray(v) ? v[0] : v)).find(Boolean)
        : null;
      const msg =
        (typeof detail === 'string' && detail) ||
        (status === 403 && 'Недостаточно прав: добавление участников доступно Director и Manager') ||
        (typeof firstField === 'string' && firstField) ||
        'Ошибка при добавлении участника';
      toast.error(msg);
    },
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'kanban', 'list', 'gantt', 'calendar', 'files', 'wiki', 'maps', 'activity', 'members'].includes(tab)) {
      setActiveTab(tab as TabId);
    }
  }, [searchParams]);

  const setTab = (tab: TabId) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'overview') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  };

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => todoApi.getProject(projectId),
    enabled: projectId > 0,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => todoApi.getProjects(),
  });

  const { data: workspace } = useQuery({
    queryKey: ['workspace', project?.workspace],
    queryFn: () => workspaceApi.getWorkspace(project!.workspace),
    enabled: !!project?.workspace,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', { project: projectId }],
    queryFn: () => todoApi.getTasks({ project: projectId }),
    enabled: projectId > 0,
  });

  const { data: metrics } = useQuery({
    queryKey: ['project-metrics', projectId],
    queryFn: () => analyticsApi.getProjectMetrics(projectId),
    enabled: projectId > 0,
  });

  const { data: ganttData, isLoading: ganttLoading, error: ganttError } = useQuery({
    queryKey: ['gantt-project', projectId],
    queryFn: () => ganttApi.getProjectTasks(projectId),
    enabled: projectId > 0 && activeTab === 'gantt',
  });

  const { data: calendarEventsData, isLoading: calendarLoading } = useQuery({
    queryKey: ['calendar-events', projectId, calendarDate],
    queryFn: () => {
      const start = moment(calendarDate).startOf('month').format('YYYY-MM-DD');
      const end = moment(calendarDate).endOf('month').format('YYYY-MM-DD');
      return calendarApi.getEventsRange(start, end, projectId);
    },
    enabled: projectId > 0 && activeTab === 'calendar',
  });

  const { data: boardsData } = useQuery({
    queryKey: ['kanban-boards', projectId],
    queryFn: () => kanbanApi.getBoards({ project: projectId }),
    enabled: projectId > 0 && activeTab === 'kanban',
  });

  const updateGanttTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { start_date: string; end_date: string } }) =>
      ganttApi.updateGanttTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt-project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Даты задачи обновлены');
    },
    onError: () => toast.error('Ошибка при обновлении задачи'),
  });

  const createDependencyMutation = useMutation({
    mutationFn: ({ predecessorId, successorId }: { predecessorId: number; successorId: number }) =>
      ganttApi.createDependency(predecessorId, successorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt-project', projectId] });
      toast.success('Зависимость добавлена');
    },
    onError: () => toast.error('Ошибка при добавлении зависимости'),
  });

  const deleteDependencyMutation = useMutation({
    mutationFn: (id: number) => ganttApi.deleteDependency(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt-project', projectId] });
      toast.success('Зависимость удалена');
    },
    onError: () => toast.error('Ошибка при удалении зависимости'),
  });

  const calendarCreateMutation = useMutation({
    mutationFn: (data: Partial<CalendarEvent> & { title: string; start_date: string; end_date: string }) =>
      calendarApi.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Событие создано');
      setCalendarModalOpen(false);
    },
    onError: () => toast.error('Ошибка при создании события'),
  });

  const calendarUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CalendarEvent> & { title: string; start_date: string; end_date: string } }) =>
      calendarApi.updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Событие обновлено');
      setCalendarModalOpen(false);
    },
    onError: () => toast.error('Ошибка при обновлении события'),
  });

  const calendarDeleteMutation = useMutation({
    mutationFn: (id: number) => calendarApi.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Событие удалено');
      setCalendarModalOpen(false);
    },
    onError: () => toast.error('Ошибка при удалении события'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => todoApi.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Проект удалён');
      navigate('/projects');
    },
    onError: () => toast.error('Ошибка при удалении проекта'),
  });

  const handleDelete = () => {
    if (window.confirm('Вы уверены, что хотите удалить этот проект?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  if (!project) {
    return <div className="text-center py-12">Проект не найден</div>;
  }

  return (
    <div className="space-y-6">
      <ProjectChatPanel projectId={projectId} />

      <ProjectHeader
        project={project}
        onEdit={() => setEditModalOpen(true)}
        onDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
      />

      <ProjectModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={project}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['activity', projectId] })}
      />

      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={null}
        projects={projectsData?.results ?? []}
        defaultProjectId={projectId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['activity', projectId] })}
      />

      {/* Tabs — Единый центр проекта */}
      <div className="border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
        <nav className="flex space-x-2 sm:space-x-4 min-w-0 shrink-0 flex-wrap gap-y-1">
          {(['overview', 'kanban', 'list', 'gantt', 'calendar', 'files', 'wiki', 'activity', 'members'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
            >
              {tab === 'overview' && 'Обзор'}
              {tab === 'kanban' && 'Этап'}
              {tab === 'list' && 'Список'}
              {tab === 'gantt' && 'Гант'}
              {tab === 'calendar' && 'Календарь'}
              {tab === 'files' && 'Файлы'}
              {tab === 'wiki' && 'Записки'}
              {tab === 'maps' && 'Maps'}
              {tab === 'activity' && 'Журнал'}
              {tab === 'members' && 'Участники'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-imperial-surface dark:border dark:border-white/5 rounded-lg shadow p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Метрики и Бюджет в одном ряду */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {metrics && (
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">Метрики проекта</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Всего задач</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{metrics.total_tasks}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Завершено</p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">{metrics.completed_tasks}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">В работе</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{metrics.wip ?? metrics.in_progress_tasks ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Прогресс</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{metrics.progress_percent ?? metrics.completion_rate ?? 0}%</p>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, metrics.progress_percent ?? metrics.completion_rate ?? 0)}%` }}
                    />
                  </div>
                  {(metrics.throughput_30_days != null || metrics.avg_lead_time_days != null) && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                      {metrics.throughput_30_days != null && `За 30 дней завершено: ${metrics.throughput_30_days}`}
                      {metrics.throughput_30_days != null && metrics.avg_lead_time_days != null && ' · '}
                      {metrics.avg_lead_time_days != null && `Среднее время: ${metrics.avg_lead_time_days} дн.`}
                    </p>
                  )}
                </div>
              )}

              {/* Виджет бюджета */}
              <ProjectBudgetWidget projectId={projectId} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Информация о проекте</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Пространство</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                    {workspace ? (
                      <Link
                        to={`/workspaces/${workspace.id}`}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                      >
                        {workspace.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Статус</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-slate-100">{project.status}</dd>
                </div>
                {project.start_date && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Дата начала</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                      {new Date(project.start_date).toLocaleDateString('ru-RU')}
                    </dd>
                  </div>
                )}
                {project.end_date && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Дата окончания</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                      {new Date(project.end_date).toLocaleDateString('ru-RU')}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/kanban?project=${project.id}`}
                className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Открыть этап
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'kanban' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Этап</h2>
            <p className="text-gray-600 dark:text-slate-400">
              Управление задачами по колонкам. Откройте полный режим для перетаскивания и редактирования.
            </p>
            <Link
              to={`/kanban?project=${projectId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Открыть этап
            </Link>
            {boardsData?.results?.length ? (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Доски проекта:</p>
                <ul className="space-y-1">
                  {boardsData.results.map((board: { id: number; name: string }) => (
                    <li key={board.id}>
                      <Link
                        to={`/kanban?project=${projectId}&board=${board.id}`}
                        className="text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {board.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'list' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Задачи проекта</h2>
              <button
                onClick={() => setTaskModalOpen(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                + Новая задача
              </button>
            </div>
            {tasksData?.results?.length ? (
              <ul className="divide-y divide-gray-200 dark:divide-slate-600">
                {tasksData.results.map((task) => (
                  <li key={task.id}>
                    <Link
                      to={`/tasks/${task.id}`}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 block text-gray-900 dark:text-imperial-text"
                    >
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-slate-100">{task.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-300">
                          {STATUS_LABELS[task.status] ?? task.status}
                        </p>
                      </div>
                      {task.due_date && (
                        <span className="text-sm text-gray-500 dark:text-slate-300">
                          {new Date(task.due_date).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-slate-300">Нет задач</p>
            )}
          </div>
        )}

        {activeTab === 'gantt' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Диаграмма Ганта</h2>
            {ganttLoading && (
              <div className="text-center py-12 text-slate-500 dark:text-imperial-muted">Загрузка диаграммы…</div>
            )}
            {ganttError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400">
                Не удалось загрузить данные Ганта. Проверьте, что в проекте есть задачи с датами.
              </div>
            )}
            {ganttData && !ganttError && (
              <div className="relative">
                <GanttChart
                  tasks={ganttData.tasks}
                  dependencies={ganttData.dependencies}
                  projectName={ganttData.project_name}
                  projectId={projectId}
                  onTaskUpdate={(taskId, data) =>
                    updateGanttTaskMutation.mutate({ id: taskId, data })
                  }
                  onDependencyCreate={(predecessorId, successorId) =>
                    createDependencyMutation.mutate({ predecessorId, successorId })
                  }
                  onDependencyDelete={(depId) => deleteDependencyMutation.mutate(depId)}
                  isUpdating={
                    updateGanttTaskMutation.isPending ||
                    createDependencyMutation.isPending ||
                    deleteDependencyMutation.isPending
                  }
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Календарь проекта</h2>
            {calendarLoading && (
              <div className="flex items-center justify-center min-h-[400px] text-slate-500 dark:text-slate-400">
                Загрузка календаря…
              </div>
            )}
            {!calendarLoading && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 min-h-[500px]">
                <Calendar
                  localizer={localizer}
                  events={(Array.isArray(calendarEventsData) ? calendarEventsData : (calendarEventsData as { results?: CalendarEvent[] })?.results ?? []).map((ev) => ({
                    id: ev.id!,
                    title: ev.title,
                    start: new Date(ev.start_date),
                    end: new Date(ev.end_date),
                    allDay: ev.all_day,
                    resource: ev,
                  }))}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: 480 }}
                  view={calendarView}
                  onView={setCalendarView}
                  date={calendarDate}
                  onNavigate={setCalendarDate}
                  onSelectSlot={({ start, end }) => {
                    setCalendarSelectedEvent(null);
                    setCalendarSlotStart(start);
                    setCalendarSlotEnd(end);
                    setCalendarModalOpen(true);
                  }}
                  onSelectEvent={(ev: { resource: CalendarEvent }) => {
                    setCalendarSelectedEvent(ev.resource);
                    setCalendarSlotStart(undefined);
                    setCalendarSlotEnd(undefined);
                    setCalendarModalOpen(true);
                  }}
                  selectable
                  messages={{
                    next: 'Следующий',
                    previous: 'Предыдущий',
                    today: 'Сегодня',
                    month: 'Месяц',
                    week: 'Неделя',
                    day: 'День',
                    agenda: 'Повестка',
                    date: 'Дата',
                    time: 'Время',
                    event: 'Событие',
                    noEventsInRange: 'Нет событий в этом диапазоне',
                  }}
                />
                <CalendarEventModal
                  isOpen={calendarModalOpen}
                  onClose={() => setCalendarModalOpen(false)}
                  event={calendarSelectedEvent}
                  defaultStart={calendarSlotStart}
                  defaultEnd={calendarSlotEnd}
                  onSave={(data) => {
                    if (calendarSelectedEvent?.id) {
                      calendarUpdateMutation.mutate({ id: calendarSelectedEvent.id, data });
                    } else {
                      calendarCreateMutation.mutate(data);
                    }
                  }}
                  onDelete={calendarSelectedEvent?.id ? () => calendarDeleteMutation.mutate(calendarSelectedEvent!.id!) : undefined}
                  isSubmitting={calendarCreateMutation.isPending || calendarUpdateMutation.isPending}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <FileList
            entityType="project"
            entityId={projectId}
            projectId={projectId}
            showUploader={true}
          />
        )}

        {activeTab === 'wiki' && <WikiTree projectId={projectId} />}

        {activeTab === 'maps' && (
          <ProjectMapsTab projectId={projectId} />
        )}

        {activeTab === 'activity' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Журнал активности</h2>
            <ProjectActivityLog projectId={projectId} />
          </div>
        )}

        {activeTab === 'members' && project && (
          <div className="space-y-8">
            {/* Участники проекта (в т.ч. теневые) — здесь можно добавить */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Участники проекта</h2>
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 dark:bg-imperial-gold dark:text-imperial-bg dark:hover:opacity-90 text-sm font-medium"
                >
                  + Добавить участника
                </button>
              </div>
              {(project.members?.length ?? 0) > 0 ? (
                <ul className="divide-y divide-slate-200 dark:divide-slate-600 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                  {(project.members ?? []).map((m: ProjectMember) => (
                    <li key={m.id} className="py-3 px-4 flex items-center gap-3 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <span className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">
                          {(m.display_name || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-slate-100">{m.display_name}</p>
                        {m.role && <p className="text-sm text-slate-500 dark:text-slate-400">{m.role}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 py-2">
                  Нет участников проекта. Нажмите «Добавить участника» или назначьте ответственного при создании задачи.
                </p>
              )}
            </div>

            {/* Участники пространства (workspace) */}
            {project.workspace && (
              <ProjectParticipants workspaceId={project.workspace} />
            )}

            {/* Диалог добавления участника */}
            {addMemberOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setAddMemberOpen(false)}>
                <div
                  className="bg-white dark:bg-imperial-surface rounded-xl shadow-xl w-full max-w-sm m-4 p-6 border border-white/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-imperial-text mb-4">Добавить участника</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-imperial-muted mb-1">Имя *</label>
                      <input
                        type="text"
                        value={addMemberName}
                        onChange={(e) => setAddMemberName(e.target.value)}
                        placeholder="Имя участника"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-imperial-surface text-gray-900 dark:text-imperial-text focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-imperial-muted mb-1">Роль</label>
                      <input
                        type="text"
                        value={addMemberRole}
                        onChange={(e) => setAddMemberRole(e.target.value)}
                        placeholder="Напр. Разработчик"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-imperial-surface text-gray-900 dark:text-imperial-text focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      type="button"
                      onClick={() => { setAddMemberOpen(false); setAddMemberName(''); setAddMemberRole(''); }}
                      className="px-4 py-2 text-gray-700 dark:text-imperial-muted bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const name = addMemberName.trim();
                        if (!name) { toast.error('Введите имя'); return; }
                        createMemberMutation.mutate({
                          project: projectId,
                          display_name: name,
                          role: addMemberRole.trim() || 'Участник',
                        });
                      }}
                      disabled={!addMemberName.trim() || createMemberMutation.isPending}
                      className="px-4 py-2 bg-primary-600 dark:bg-imperial-gold text-white dark:text-imperial-bg rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {createMemberMutation.isPending ? 'Создание…' : 'Добавить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
