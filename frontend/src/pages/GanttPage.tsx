import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ganttApi } from '../api/gantt';
import { kanbanApi } from '../api/kanban';
import { coreApi } from '../api/core';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import GanttChart from '../components/gantt/GanttChart';
import { TaskDetailModal } from './KanbanPage';
import type { KanbanItem } from '../types';
import type { GanttTask } from '../types';
import toast from 'react-hot-toast';

/** Значение фильтра спринтов: все, только бэклог, или массив id спринтов */
type SprintFilterValue = 'all' | 'backlog' | number[];

export default function GanttPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projectId = id ? Number(id) : null;
  const [selectedItem, setSelectedItem] = useState<KanbanItem | null>(null);
  const [itemModalTab, setItemModalTab] = useState<'details' | 'subtasks' | 'files' | 'wiki' | 'comments'>('details');
  const [sprintFilter, setSprintFilter] = useState<SprintFilterValue>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [responsibleFilter, setResponsibleFilter] = useState<number | ''>('');

  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => todoApi.getProjects(),
  });

  const projects = projectsData?.results ?? [];
  const firstProjectId = projects[0]?.id;

  const effectiveProjectId = projectId ?? firstProjectId ?? 0;

  const { data: boardsData } = useQuery({
    queryKey: ['kanban-boards', currentWorkspace?.id, effectiveProjectId],
    queryFn: () => kanbanApi.getBoards({ workspace_id: currentWorkspace!.id, project: effectiveProjectId }),
    enabled: !!currentWorkspace?.id && effectiveProjectId > 0,
  });
  const sprints = boardsData?.results ?? [];

  const { data: projectMembers } = useQuery({
    queryKey: ['project-members', effectiveProjectId],
    queryFn: () => coreApi.getProjectMembers(effectiveProjectId),
    enabled: effectiveProjectId > 0,
  });
  const members = projectMembers ?? [];

  const ganttParams = useMemo(() => {
    const params: { sprint_id?: number[] | 'null'; user_id?: number; priority?: string } = {};
    if (sprintFilter === 'backlog') params.sprint_id = 'null';
    else if (Array.isArray(sprintFilter) && sprintFilter.length > 0) params.sprint_id = sprintFilter;
    if (responsibleFilter !== '') params.user_id = responsibleFilter;
    if (priorityFilter) params.priority = priorityFilter;
    return params;
  }, [sprintFilter, priorityFilter, responsibleFilter]);

  const { data: ganttData, isLoading, error } = useQuery({
    queryKey: ['gantt-project', effectiveProjectId, ganttParams],
    queryFn: () => ganttApi.getProjectTasks(effectiveProjectId, ganttParams),
    enabled: effectiveProjectId > 0,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({
      id: taskId,
      data,
    }: {
      id: number;
      data: { start_date: string; end_date: string };
    }) => ganttApi.updateGanttTask(taskId, data),
    onMutate: async ({ id: taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['gantt-project', effectiveProjectId] });
      const previous = queryClient.getQueryData<typeof ganttData>(['gantt-project', effectiveProjectId]);
      if (previous?.tasks) {
        const updateTaskInTree = (tasks: typeof previous.tasks): typeof previous.tasks =>
          tasks.map((t) =>
            t.id === taskId
              ? { ...t, start_date: data.start_date, end_date: data.end_date }
              : t.children?.length
                ? { ...t, children: updateTaskInTree(t.children) }
                : t
          );
        queryClient.setQueryData(['gantt-project', effectiveProjectId], {
          ...previous,
          tasks: updateTaskInTree(previous.tasks),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['gantt-project', effectiveProjectId], context.previous);
      }
      toast.error('Ошибка при обновлении задачи');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt-project', effectiveProjectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board-full'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Даты задачи обновлены');
    },
  });

  const createDependencyMutation = useMutation({
    mutationFn: ({ predecessorId, successorId }: { predecessorId: number; successorId: number }) =>
      ganttApi.createDependency(predecessorId, successorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt-project', effectiveProjectId] });
      toast.success('Зависимость добавлена');
    },
    onError: (err: { response?: { data?: { detail?: string; predecessor?: string[]; successor?: string[] } } }) => {
      const data = err?.response?.data;
      const msg =
        (typeof data?.detail === 'string' && data.detail) ||
        (Array.isArray(data?.successor) && data.successor[0]) ||
        (Array.isArray(data?.predecessor) && data.predecessor[0]) ||
        'Ошибка при добавлении зависимости';
      toast.error(msg);
    },
  });

  const deleteDependencyMutation = useMutation({
    mutationFn: (id: number) => ganttApi.deleteDependency(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt-project', effectiveProjectId] });
      toast.success('Зависимость удалена');
    },
    onError: () => toast.error('Ошибка при удалении зависимости'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (workitemId: number) => todoApi.deleteTask(workitemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt-project', effectiveProjectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedItem(null);
      toast.success('Задача удалена');
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const detail = ax?.response?.data?.detail;
      const status = ax?.response?.status;
      const msg =
        (typeof detail === 'string' && detail) ||
        (status === 404 && 'Задача не найдена или уже удалена') ||
        (status === 403 && 'Нет прав на удаление') ||
        (typeof ax?.message === 'string' && ax.message) ||
        'Ошибка при удалении задачи';
      toast.error(msg);
    },
  });

  const handleTaskClick = (task: GanttTask) => {
    if (task.related_workitem) {
      setSelectedItem({
        id: task.related_workitem,
        title: task.name,
        sort_order: 0,
      });
    }
  };

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-imperial-text">Диаграмма Ганта</h1>
        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-imperial-surface p-8 text-center text-slate-600 dark:text-imperial-muted">
          Нет проектов. Создайте проект, чтобы увидеть задачи на диаграмме Ганта.
          <br />
          <Link to="/projects" className="text-blue-600 dark:text-imperial-gold hover:underline mt-2 inline-block">
            Перейти к проектам
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-imperial-text">Диаграмма Ганта</h1>
          <p className="text-slate-600 dark:text-imperial-muted mt-1">
            Временная шкала задач по проекту. Задачи синхронизируются с разделом «Задачи».
          </p>
        </div>
        {projects.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-imperial-muted">Проект:</span>
            <select
              value={effectiveProjectId}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v) navigate(`/gantt/${v}`);
              }}
              className="px-3 py-2 border border-slate-300 dark:border-white/10 rounded-xl text-slate-800 dark:text-imperial-text bg-white dark:bg-imperial-surface"
            >
              {projects.map((p: { id: number; name: string }) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {effectiveProjectId > 0 && (
              <Link
                to={`/projects/${effectiveProjectId}`}
                className="text-sm text-blue-600 dark:text-imperial-gold hover:underline"
              >
                Открыть проект
              </Link>
            )}
          </div>
        )}
      </div>

      {effectiveProjectId > 0 && (
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-imperial-surface/80 shadow-sm">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Фильтры:</span>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 dark:text-slate-400">Спринты</label>
            <select
              value={
                sprintFilter === 'all'
                  ? 'all'
                  : sprintFilter === 'backlog'
                    ? 'backlog'
                    : Array.isArray(sprintFilter) ? sprintFilter.join(',') : 'all'
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'all') setSprintFilter('all');
                else if (v === 'backlog') setSprintFilter('backlog');
                else if (v) setSprintFilter(v.split(',').map((x) => Number(x.trim())).filter(Boolean));
                else setSprintFilter('all');
              }}
              className="px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm min-w-[140px]"
            >
              <option value="all">Все спринты</option>
              <option value="backlog">Бэклог (без спринта)</option>
              {sprints.map((s: { id: number; name: string }) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 dark:text-slate-400">Приоритет</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm min-w-[120px]"
            >
              <option value="">Все</option>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
              <option value="urgent">Срочный</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 dark:text-slate-400">Ответственный</label>
            <select
              value={responsibleFilter === '' ? '' : String(responsibleFilter)}
              onChange={(e) => setResponsibleFilter(e.target.value === '' ? '' : Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm min-w-[140px]"
            >
              <option value="">Все</option>
              {members.map((m: { id: number; display_name: string }) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-slate-500 dark:text-imperial-muted">Загрузка диаграммы...</div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400">
          Не удалось загрузить данные Ганта. Проверьте, что в проекте есть задачи с датами.
        </div>
      )}

      {selectedItem && effectiveProjectId > 0 && (
        <TaskDetailModal
          item={selectedItem}
          projectId={effectiveProjectId}
          projects={projects}
          workspaceId={currentWorkspace?.id}
          onClose={() => setSelectedItem(null)}
          activeTab={itemModalTab}
          onTabChange={setItemModalTab}
          onTaskUpdate={(data) => {
            if (!selectedItem) return;
            todoApi
              .updateTask(selectedItem.id, data)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['gantt-project', effectiveProjectId] });
                queryClient.invalidateQueries({ queryKey: ['task', selectedItem.id] });
                setSelectedItem({ ...selectedItem, ...data });
                toast.success('Задача обновлена');
              })
              .catch(() => toast.error('Ошибка при обновлении задачи'));
          }}
          onDeleteTask={() => {
            if (!selectedItem) return;
            const workItemId = selectedItem.id;
            if (typeof workItemId !== 'number' || workItemId <= 0) {
              toast.error('Не удалось определить задачу для удаления');
              return;
            }
            if (window.confirm('Удалить задачу?')) {
              deleteTaskMutation.mutate(workItemId);
            }
          }}
        />
      )}

      {ganttData && !error && (
        <div className="relative">
          <GanttChart
            tasks={ganttData.tasks}
            dependencies={ganttData.dependencies}
            projectName={ganttData.project_name}
            projectId={effectiveProjectId}
            onTaskUpdate={(taskId, data) =>
              updateTaskMutation.mutate({ id: taskId, data })
            }
            onTaskClick={handleTaskClick}
            onDependencyCreate={(predecessorId, successorId) =>
              createDependencyMutation.mutate({ predecessorId, successorId })
            }
            onDependencyDelete={(depId) => deleteDependencyMutation.mutate(depId)}
            isUpdating={
              updateTaskMutation.isPending ||
              createDependencyMutation.isPending ||
              deleteDependencyMutation.isPending
            }
          />
        </div>
      )}
    </div>
  );
}
