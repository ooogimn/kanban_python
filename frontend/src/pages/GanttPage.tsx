import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx-js-style';
import { Maximize2, Minimize2, LayoutGrid, List } from 'lucide-react';
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

function flattenGanttTasks(tasks: GanttTask[]): GanttTask[] {
  const out: GanttTask[] = [];
  function walk(list: GanttTask[]) {
    for (const t of list) {
      out.push(t);
      if (t.children?.length) walk(t.children);
    }
  }
  walk(tasks);
  return out;
}

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
  const [exportLoading, setExportLoading] = useState<'jpg' | 'pdf' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedProjectIdForModal, setSelectedProjectIdForModal] = useState(0);
  const ganttPageRef = useRef<HTMLDivElement>(null);

  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => todoApi.getProjects(),
  });

  const projects = projectsData?.results ?? [];

  const effectiveProjectId = projectId ?? 0;

  const { data: boardsData } = useQuery({
    queryKey: ['kanban-boards', currentWorkspace?.id, effectiveProjectId],
    queryFn: () =>
      kanbanApi.getBoards({
        workspace_id: currentWorkspace!.id,
        project: effectiveProjectId > 0 ? effectiveProjectId : undefined,
      }),
    enabled: !!currentWorkspace?.id,
  });
  const sprints = boardsData?.results ?? [];

  const { data: projectMembers } = useQuery({
    queryKey: ['project-members', effectiveProjectId],
    queryFn: () => coreApi.getProjectMembers(effectiveProjectId),
    enabled: effectiveProjectId > 0,
  });

  const { data: workspaceMembersData } = useQuery({
    queryKey: ['workspace-members', currentWorkspace?.id],
    queryFn: () => workspaceApi.getWorkspaceMembers(currentWorkspace!.id),
    enabled: !!currentWorkspace?.id && effectiveProjectId === 0,
  });

  const members = effectiveProjectId > 0
    ? (projectMembers ?? [])
    : (workspaceMembersData ?? []).map((m: { user?: { id: number; username?: string; first_name?: string } }) => ({
        id: m.user?.id ?? 0,
        display_name: m.user?.username ?? m.user?.first_name ?? `User ${m.user?.id ?? ''}`,
      })).filter((m: { id: number }) => m.id > 0);

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

  const { data: ganttAllData, isLoading: isLoadingAll, error: errorAll } = useQuery({
    queryKey: ['gantt-all-projects', projects.map((p: { id: number }) => p.id), ganttParams],
    queryFn: async () => {
      const results = await Promise.all(
        projects.map((p: { id: number; name: string }) =>
          ganttApi.getProjectTasks(p.id, ganttParams)
        )
      );
      return {
        project_id: 0,
        project_name: 'Все проекты',
        tasks: results.flatMap((r) => r.tasks),
        dependencies: results.flatMap((r) => r.dependencies),
      };
    },
    enabled: effectiveProjectId === 0 && projects.length > 0,
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
      queryClient.invalidateQueries({ queryKey: ['gantt-project'] });
      queryClient.invalidateQueries({ queryKey: ['gantt-all-projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board-full'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Даты задачи обновлены');
    },
  });

  const createDependencyMutation = useMutation({
    mutationFn: ({
      predecessorId,
      successorId,
      type,
      lagDays,
    }: {
      predecessorId: number;
      successorId: number;
      type?: 'FS' | 'SS' | 'FF' | 'SF';
      lagDays?: number;
    }) => ganttApi.createDependency(predecessorId, successorId, type ?? 'FS', lagDays ?? 0),
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
      queryClient.invalidateQueries({ queryKey: ['gantt-project'] });
      queryClient.invalidateQueries({ queryKey: ['gantt-all-projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedItem(null);
      setSelectedProjectIdForModal(0);
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
    if (!task.related_workitem) return;
    const item = { id: task.related_workitem, title: task.name, sort_order: 0 };
    if (effectiveProjectId > 0) {
      setSelectedItem(item);
      return;
    }
    todoApi.getTask(task.related_workitem).then((t) => {
      setSelectedItem(item);
      setSelectedProjectIdForModal(t.project ?? 0);
    }).catch(() => toast.error('Не удалось загрузить задачу'));
  };

  const exportOptions = { pixelRatio: 2, cacheBust: true };
  const handleExportJpg = useCallback(() => {
    const el = ganttPageRef.current;
    if (!el) return;
    setExportLoading('jpg');
    toJpeg(el, { ...exportOptions, quality: 0.95 })
      .then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `gantt-${Date.now()}.jpg`;
        a.click();
        toast.success('Сохранено в JPG');
      })
      .catch((err) => {
        console.error('Export JPG failed', err);
        toast.error('Не удалось сохранить JPG');
      })
      .finally(() => setExportLoading(null));
  }, []);
  const handleExportPdf = useCallback(() => {
    const el = ganttPageRef.current;
    if (!el) return;
    setExportLoading('pdf');
    toPng(el, exportOptions)
      .then((dataUrl) => {
        const img = new Image();
        img.onload = () => {
          const pdf = new jsPDF({
            orientation: img.width > img.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [img.width, img.height],
          });
          pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
          pdf.save(`gantt-${Date.now()}.pdf`);
          toast.success('Сохранено в PDF');
        };
        img.onerror = () => setExportLoading(null);
        img.src = dataUrl;
      })
      .catch((err) => {
        console.error('Export PDF failed', err);
        toast.error('Не удалось сохранить PDF');
      })
      .finally(() => setExportLoading(null));
  }, []);
  const handleExportExcel = useCallback(() => {
    const data = effectiveProjectId > 0 ? ganttData : ganttAllData;
    const flat = data?.tasks ? flattenGanttTasks(data.tasks) : [];
    const rows: (string | number)[][] = [
      ['Задача', 'Начало', 'Окончание', 'Прогресс %'],
      ...flat.map((t) => [
        t.name ?? '',
        t.start_date ?? '',
        t.end_date ?? '',
        t.progress ?? 0,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Гант');
    XLSX.writeFile(wb, `gantt-${Date.now()}.xlsx`);
    toast.success('Сохранено в Excel');
  }, [effectiveProjectId, ganttData?.tasks, ganttAllData?.tasks]);
  const handleFullscreen = useCallback(() => {
    const el = ganttPageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => toast.error('Полный экран недоступен'));
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false));
    }
  }, []);
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

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
    <div ref={ganttPageRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Диаграмма Ганта</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Временная шкала задач по проекту. Задачи синхронизируются с разделом «Задачи».
          </p>
        </div>
        <div className="flex flex-nowrap items-center gap-1.5">
          <Link
            to="/tasks?create=1"
            className="px-2 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium text-xs"
            title="Новая задача"
          >
            +
          </Link>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button
            type="button"
            onClick={handleExportJpg}
            disabled={!!exportLoading}
            className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs"
          >
            JPG
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!!exportLoading}
            className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!(effectiveProjectId > 0 ? ganttData?.tasks?.length : ganttAllData?.tasks?.length)}
            className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs"
          >
            Excel
          </button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button type="button" className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 cursor-default" title="Сетка" aria-hidden>
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button type="button" className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 cursor-default" title="Список" aria-hidden>
            <List className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button
            type="button"
            onClick={handleFullscreen}
            className="p-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            title={isFullscreen ? 'Свернуть' : 'Во весь экран'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 p-2 flex flex-wrap gap-2 items-end">
        <div className="min-w-0 flex-1 sm:flex-initial">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Проект</label>
          <select
            value={effectiveProjectId || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') navigate('/gantt');
              else navigate(`/gantt/${v}`);
            }}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10.2rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Все проекты</option>
            {projects.map((p: { id: number; name: string }) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1 sm:flex-initial">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Спринты</label>
          <select
            value={sprintFilter === 'all' ? 'all' : sprintFilter === 'backlog' ? 'backlog' : Array.isArray(sprintFilter) ? sprintFilter.join(',') : 'all'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'all') setSprintFilter('all');
              else if (v === 'backlog') setSprintFilter('backlog');
              else if (v) setSprintFilter(v.split(',').map((x) => Number(x.trim())).filter(Boolean));
              else setSprintFilter('all');
            }}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10.2rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="all">Все спринты</option>
            <option value="backlog">Бэклог</option>
            {sprints.map((s: { id: number; name: string }) => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
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
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
            <option value="urgent">Срочный</option>
          </select>
        </div>
        {currentWorkspace?.id && (
          <div className="min-w-0 flex-1 sm:flex-initial">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Исполнитель</label>
            <select
              value={responsibleFilter === '' ? '' : String(responsibleFilter)}
              onChange={(e) => setResponsibleFilter(e.target.value === '' ? '' : Number(e.target.value))}
              className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10.2rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">Все</option>
              {members.map((m: { id: number; display_name: string }) => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {(effectiveProjectId > 0 ? isLoading : isLoadingAll) && (
        <div className="text-center py-12 text-slate-500 dark:text-imperial-muted">Загрузка диаграммы...</div>
      )}

      {(effectiveProjectId > 0 ? error : errorAll) && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400">
          Не удалось загрузить данные Ганта. Проверьте, что в проектах есть задачи с датами.
        </div>
      )}

      {effectiveProjectId === 0 && !isLoadingAll && !errorAll && !ganttAllData?.tasks?.length && projects.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
          Нет задач с датами во всех проектах. Выберите проект или добавьте задачи с датами.
        </div>
      )}

      {selectedItem && (effectiveProjectId > 0 ? effectiveProjectId : selectedProjectIdForModal) > 0 && (
        <TaskDetailModal
          item={selectedItem}
          projectId={effectiveProjectId > 0 ? effectiveProjectId : selectedProjectIdForModal}
          projects={projects}
          workspaceId={currentWorkspace?.id}
          onClose={() => { setSelectedItem(null); setSelectedProjectIdForModal(0); }}
          activeTab={itemModalTab}
          onTabChange={setItemModalTab}
          onTaskUpdate={(data) => {
            if (!selectedItem) return;
            todoApi
              .updateTask(selectedItem.id, data)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['gantt-project'] });
                queryClient.invalidateQueries({ queryKey: ['gantt-all-projects'] });
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

      {(() => {
        const displayData = effectiveProjectId > 0 ? ganttData : ganttAllData;
        const hasError = effectiveProjectId > 0 ? error : errorAll;
        if (!displayData || hasError) return null;
        return (
          <div className="relative">
            <GanttChart
              tasks={displayData.tasks}
              dependencies={displayData.dependencies}
              projectName={displayData.project_name}
              projectId={effectiveProjectId || 0}
              onTaskUpdate={(taskId, data) =>
                updateTaskMutation.mutate({ id: taskId, data })
              }
              onTaskClick={handleTaskClick}
              onDependencyCreate={(predecessorId, successorId, type, lagDays) =>
                createDependencyMutation.mutate({ predecessorId, successorId, type, lagDays })
              }
              onDependencyDelete={(depId) => deleteDependencyMutation.mutate(depId)}
              isUpdating={
                updateTaskMutation.isPending ||
                createDependencyMutation.isPending ||
                deleteDependencyMutation.isPending
              }
            />
          </div>
        );
      })()}
    </div>
  );
}
