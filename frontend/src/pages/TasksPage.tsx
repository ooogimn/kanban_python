import { useState, useEffect, useCallback } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import { timetrackingApi } from '../api/timetracking';
import { WorkItem } from '../types';
import type { KanbanItem } from '../types';
import TaskModal from '../components/TaskModal';
import { TaskDetailModal } from './KanbanPage';
import toast from 'react-hot-toast';

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function TaskRowTimer({
  task,
  queryKey,
  onComplete,
}: {
  task: WorkItem;
  queryKey: unknown[];
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);

  const { data: timerData } = useQuery({
    queryKey: ['active-timer', task.id],
    queryFn: () => timetrackingApi.getActiveTimerForTask(task.id),
  });
  const { data: summaryData } = useQuery({
    queryKey: ['time-summary', task.id],
    queryFn: () => timetrackingApi.getSummary(task.id),
  });

  const isRunning = timerData?.is_running ?? false;
  const activeTimer = timerData?.active;

  useEffect(() => {
    if (activeTimer?.elapsed_seconds != null) setElapsed(activeTimer.elapsed_seconds);
    else setElapsed(0);
  }, [activeTimer]);

  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  const startMutation = useMutation({
    mutationFn: () => timetrackingApi.startTimer(task.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-timer', task.id] });
      queryClient.invalidateQueries({ queryKey: ['time-summary', task.id] });
      setElapsed(data.elapsed_seconds || 0);
      toast.success('Таймер запущен');
    },
    onError: () => toast.error('Ошибка запуска таймера'),
  });
  const stopMutation = useMutation({
    mutationFn: () => timetrackingApi.stopTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer', task.id] });
      queryClient.invalidateQueries({ queryKey: ['time-summary', task.id] });
      setElapsed(0);
      toast.success('Таймер остановлен');
    },
    onError: () => toast.error('Ошибка остановки таймера'),
  });
  const completeMutation = useMutation({
    mutationFn: () => todoApi.completeTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      onComplete();
      toast.success('Задача завершена');
    },
    onError: () => toast.error('Ошибка завершения задачи'),
  });

  const pending = startMutation.isPending || stopMutation.isPending || completeMutation.isPending;
  const totalMin = summaryData?.total_minutes ?? 0;
  // При продолжении таймера показываем суммарное время (уже учтённые сегменты + текущий)
  const displayTime = isRunning
    ? formatTimer(totalMin * 60 + elapsed)
    : totalMin > 0
      ? `${totalMin} мин`
      : '0:00';

  const showPauseResume =
    task.status === 'in_progress' || task.status === 'review' || isRunning;
  const showStart =
    task.status !== 'in_progress' &&
    task.status !== 'review' &&
    task.status !== 'completed' &&
    task.status !== 'cancelled';

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-sm font-mono text-slate-600 dark:text-slate-400 min-w-[4rem] tabular-nums">
        {displayTime}
      </span>
      {showStart && (
        <button
          type="button"
          onClick={() => startMutation.mutate()}
          disabled={pending || isRunning}
          className="px-2 py-1 text-xs font-medium rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Старт
        </button>
      )}
      {showPauseResume && (
        <button
          type="button"
          onClick={() => (isRunning ? stopMutation.mutate() : startMutation.mutate())}
          disabled={pending}
          className="px-2 py-1 text-xs font-medium rounded bg-slate-500 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          title={isRunning ? 'Приостановить таймер' : 'Продолжить отсчёт'}
        >
          {isRunning ? 'Пауза' : 'Продолжить'}
        </button>
      )}
      {task.status === 'completed' ? (
        <span className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white cursor-default">
          ЗАВЕРШЕНА
        </span>
      ) : (
        <button
          type="button"
          onClick={() => completeMutation.mutate()}
          disabled={pending}
          className="px-2 py-1 text-xs font-medium rounded bg-slate-600 hover:bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Готово
        </button>
      )}
    </div>
  );
}

function getNextPageParam(nextUrl: string | null | undefined): number | undefined {
  if (!nextUrl) return undefined;
  const m = nextUrl.match(/[?&]page=(\d+)/);
  return m ? Number(m[1]) : undefined;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
};

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KanbanItem | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [itemModalTab, setItemModalTab] = useState<'details' | 'subtasks' | 'files' | 'wiki' | 'comments'>('details');
  const [projectFilter, setProjectFilter] = useState<number | ''>(() => {
    const p = searchParams.get('project');
    return p ? Number(p) : '';
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState<string>(() => searchParams.get('priority') || '');
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('search') || '');
  const [assigneeFilter, setAssigneeFilter] = useState<number | ''>(() => {
    const a = searchParams.get('assigned_to');
    return a ? Number(a) : '';
  });

  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => todoApi.getProjects(),
  });

  const { data: members } = useQuery({
    queryKey: ['workspace-members', currentWorkspace?.id],
    queryFn: () => workspaceApi.getWorkspaceMembers(currentWorkspace!.id),
    enabled: !!currentWorkspace?.id,
  });

  const params: { project?: number; status?: string; priority?: string; search?: string; assigned_to?: number; page?: number } = {};
  if (projectFilter) params.project = projectFilter;
  if (statusFilter) params.status = statusFilter;
  if (priorityFilter) params.priority = priorityFilter;
  if (searchQuery.trim()) params.search = searchQuery.trim();
  if (assigneeFilter) params.assigned_to = assigneeFilter;

  const queryKey = ['tasks', params.project ?? '', params.status ?? '', params.priority ?? '', params.search ?? '', params.assigned_to ?? ''];

  const {
    data: tasksData,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 1 }) => todoApi.getTasks({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => getNextPageParam(lastPage?.next),
    initialPageParam: 1,
  });

  const tasks = tasksData?.pages?.flatMap((p) => p?.results ?? []) ?? [];

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setModalOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const taskIdFromUrl = searchParams.get('task');
  useEffect(() => {
    if (!taskIdFromUrl || tasks.length === 0) return;
    const id = Number(taskIdFromUrl);
    if (Number.isNaN(id)) return;
    const task = tasks.find((t) => t.id === id);
    if (task && !selectedItem) {
      setSelectedItem({ id: task.id, title: task.title, sort_order: 0 });
      setSelectedProjectId(task.project);
    }
  }, [taskIdFromUrl, tasks, selectedItem]);

  // Синхронизация фильтров с URL (можно делиться ссылкой с применёнными фильтрами)
  useEffect(() => {
    const next: Record<string, string> = {};
    if (projectFilter) next.project = String(projectFilter);
    if (statusFilter) next.status = statusFilter;
    if (priorityFilter) next.priority = priorityFilter;
    if (searchQuery.trim()) next.search = searchQuery.trim();
    if (assigneeFilter) next.assigned_to = String(assigneeFilter);
    const current = Object.fromEntries(
      [...searchParams.entries()].filter(([k]) => ['project', 'status', 'priority', 'search', 'assigned_to'].includes(k))
    );
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    setSearchParams(next, { replace: true });
  }, [projectFilter, statusFilter, priorityFilter, searchQuery, assigneeFilter, searchParams, setSearchParams]);

  const deleteTaskMutation = useMutation({
    mutationFn: (workitemId: number) => todoApi.deleteTask(workitemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setSelectedItem(null);
      toast.success('Задача удалена');
    },
    onError: () => toast.error('Ошибка при удалении задачи'),
  });

  const handleOpenTask = (task: WorkItem, initialTab?: 'details' | 'subtasks' | 'files' | 'wiki' | 'comments') => {
    setSelectedItem({ id: task.id, title: task.title, sort_order: 0 });
    setSelectedProjectId(task.project ?? 0);
    if (initialTab) setItemModalTab(initialTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('task', String(task.id));
      return next;
    }, { replace: true });
  };

  const handleCloseTaskModal = () => {
    setSelectedItem(null);
    setSelectedProjectId(0);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('task');
      return next;
    }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Задачи</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Управление задачами</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + Новая задача
        </button>
      </div>

      {/* Filters — компактные, ширина +30% по оси X */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 p-2 flex flex-wrap gap-2 items-end">
        <div className="min-w-0 flex-1 sm:flex-initial sm:min-w-[170px]">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Поиск</label>
          <input
            type="search"
            placeholder="Название или описание..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[11.8rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="min-w-0 flex-1 sm:flex-initial">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Проект</label>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : '')}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10.2rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Все</option>
            {(projects?.results ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Статус</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[8.5rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Все</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Приоритет</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[8.5rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Все</option>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {currentWorkspace?.id && (
          <div className="min-w-0 flex-1 sm:flex-initial">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Исполнитель</label>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value ? Number(e.target.value) : '')}
              className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10.2rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">Все</option>
              {(Array.isArray(members) ? members : []).map((m: { user?: { id: number; username?: string } }) => (
                <option key={m.user?.id} value={m.user?.id ?? ''}>
                  {m.user?.username ?? `User ${m.user?.id}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Загрузка...</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-500 dark:text-red-400">
            Ошибка загрузки задач. {(error as Error)?.message || 'Проверьте подключение.'}
          </div>
        ) : (tasks?.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Нет задач</div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-600">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between p-4 border-l-4"
                style={{
                  borderLeftColor: (task as WorkItem).color || '#fbbf24',
                  boxShadow: `inset 4px 0 12px ${((task as WorkItem).color || '#fbbf24')}50`,
                }}
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleOpenTask(task)}
                    className="font-medium text-slate-900 dark:text-slate-100 truncate text-left hover:underline focus:outline-none focus:underline"
                  >
                    {task.title}
                  </button>
                  <p className="text-[7px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {STATUS_LABELS[task.status] ?? task.status} · {PRIORITY_LABELS[task.priority] ?? task.priority}
                    {'project_name' in task && (task as WorkItem & { project_name?: string }).project_name && (
                      <> · {(task as WorkItem & { project_name?: string }).project_name}</>
                    )}
                  </p>
                </div>
                {(() => {
                  const stats = (task as WorkItem & { checklist_stats?: { total: number; done: number } }).checklist_stats;
                  const total = stats?.total ?? 0;
                  const done = stats?.done ?? 0;
                  const isCompleted = task.status === 'completed';
                  const displayDone = isCompleted ? total : done;
                  const displayTotal = total;
                  const percent = total > 0 ? (isCompleted ? 100 : Math.round((done / total) * 100)) : 0;
                  if (total === 0) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => handleOpenTask(task as WorkItem, 'subtasks')}
                      className="shrink-0 w-48 flex flex-col justify-center gap-0.5 mr-10 text-left cursor-pointer hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded"
                      title="Подзадачи — открыть вкладку"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex gap-0.5 min-w-0">
                          {Array.from({ length: displayTotal }, (_, i) => (
                            <div
                              key={i}
                              className={`flex-1 min-w-0 h-2 rounded-sm first:rounded-l last:rounded-r ${i < displayDone ? 'bg-imperial-gold' : 'bg-gray-200 dark:bg-white/10'}`}
                              title={i < displayDone ? 'Выполнено' : 'Не выполнено'}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                          {displayDone}/{displayTotal}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {percent}%
                      </span>
                    </button>
                  );
                })()}
                <TaskRowTimer
                  task={task as WorkItem}
                  queryKey={queryKey}
                  onComplete={() => { }}
                />
                {task.due_date && (
                  <span className="text-sm text-gray-500 shrink-0 ml-4">
                    {new Date(task.due_date).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hasNextPage && (
        <div className="text-center py-4">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Загрузка…' : 'Показать ещё'}
          </button>
        </div>
      )}

      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        task={null}
        projects={projects?.results ?? []}
      />

      {selectedItem && (
        <TaskDetailModal
          item={selectedItem}
          projectId={selectedProjectId || 0}
          projects={projects?.results ?? []}
          workspaceId={currentWorkspace?.id}
          onClose={handleCloseTaskModal}
          activeTab={itemModalTab}
          onTabChange={setItemModalTab}
          onTaskUpdate={(data) => {
            if (!selectedItem) return;
            todoApi
              .updateTask(selectedItem.id, data as Partial<WorkItem>)
              .then(() => {
                queryClient.invalidateQueries({ queryKey });
                queryClient.invalidateQueries({ queryKey: ['task', selectedItem.id] });
                setSelectedItem({ ...selectedItem, ...data });
                toast.success('Задача обновлена');
              })
              .catch(() => toast.error('Ошибка при обновлении задачи'));
          }}
          onDeleteTask={() => {
            if (selectedItem && window.confirm('Удалить задачу?')) {
              deleteTaskMutation.mutate(selectedItem.id);
              handleCloseTaskModal();
            }
          }}
        />
      )}
    </div>
  );
}
