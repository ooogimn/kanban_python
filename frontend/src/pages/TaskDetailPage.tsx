import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '../api/todo';
import { mindmapsApi } from '../api/mindmaps';
import { FileList, CommentThread } from '../components/documents';
import { useQuery } from '@tanstack/react-query';
import TaskModal from '../components/TaskModal';
import TaskActivityLog from '../components/TaskActivityLog';
import TaskTimer from '../components/TaskTimer';
import toast from 'react-hot-toast';

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

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const taskId = id ? Number(id) : 0;
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'comments' | 'activity'>('overview');
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => todoApi.getTask(taskId),
    enabled: taskId > 0,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => todoApi.getProjects(),
  });

  const { data: taskMaps = [] } = useQuery({
    queryKey: ['mindmaps', 'workitem', taskId],
    queryFn: () => mindmapsApi.getList({ related_workitem_id: taskId }),
    enabled: taskId > 0,
  });

  const completeMutation = useMutation({
    mutationFn: () => todoApi.completeTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-dashboard'] });
      toast.success('Задача завершена');
    },
    onError: () => toast.error('Ошибка при завершении задачи'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => todoApi.cancelTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-dashboard'] });
      toast.success('Задача отменена');
    },
    onError: () => toast.error('Ошибка при отмене задачи'),
  });

  if (isLoading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  if (!task) {
    return <div className="text-center py-12">Задача не найдена</div>;
  }

  const projects = projectsData?.results ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/tasks"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Назад к задачам
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
          <p className="text-gray-600 mt-1">
            {STATUS_LABELS[task.status] ?? task.status} · {PRIORITY_LABELS[task.priority] ?? task.priority}
          </p>
        </div>
        <div className="flex gap-2">
          {task.status !== 'completed' && task.status !== 'cancelled' && (
            <>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Завершить
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                Отменить
              </button>
            </>
          )}
          <button
            onClick={() => setEditModalOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Редактировать
          </button>
        </div>
      </div>

      {/* Таймер */}
      {task.status !== 'completed' && task.status !== 'cancelled' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
          <TaskTimer workitemId={taskId} />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Обзор
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'files'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Файлы
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'comments'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Комментарии
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'activity'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Журнал
          </button>
          <button
            onClick={() => setActiveTab('maps')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'maps'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Maps
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {task.description && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Описание</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Срок</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Прогресс</dt>
                <dd className="mt-1 text-sm text-gray-900">{task.progress}%</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Создано</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {task.created_at ? new Date(task.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Обновлено</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {task.updated_at ? new Date(task.updated_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </dd>
              </div>
            </dl>
            {Array.isArray(task.assigned_to) && task.assigned_to.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Исполнители</h3>
                <ul className="flex flex-wrap gap-2">
                  {task.assigned_to.map((u: number | { id?: number; username?: string }, idx: number) => {
                    const id = typeof u === 'object' && u?.id != null ? u.id : u;
                    const name = typeof u === 'object' && u?.username != null ? u.username : `#${id}`;
                    const key = typeof id === 'number' ? id : `assigned-${idx}`;
                    return (
                      <li key={key} className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-800">
                        {name}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-slate-400">Проект: </span>
              <Link
                to={`/projects/${task.project}`}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                {projects.find((p) => p.id === task.project)?.name ?? `Проект #${task.project}`} →
              </Link>
            </div>
            {(task.source_details ?? task.source_type) && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-4">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Источник задачи</h3>
                {task.source_details ? (
                  task.source_details.type === 'wikipage' ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Создано из записи
                      {task.source_details.url ? (
                        <Link
                          to={task.source_details.url}
                          className="ml-1 text-primary-600 hover:text-primary-700 font-medium"
                        >
                          «{task.source_details.label}» →
                        </Link>
                      ) : (
                        <span className="ml-1">«{task.source_details.label}»</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Создано из комментария
                      {task.source_details.url ? (
                        <Link
                          to={task.source_details.url}
                          className="ml-1 text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {task.source_details.label} →
                        </Link>
                      ) : (
                        <span className="ml-1">{task.source_details.label}</span>
                      )}
                    </p>
                  )
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {task.source_type === 'wikipage' ? 'Запись' : 'Комментарий'}
                    {task.source_id != null && ` #${task.source_id}`}
                  </p>
                )}
              </div>
            )}
            {task.dependencies && task.dependencies.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Зависимости (нужно выполнить перед этой задачей)</h3>
                <ul className="space-y-1">
                  {task.dependencies.map((depId: number) => (
                    <li key={depId}>
                      <Link
                        to={`/tasks/${depId}`}
                        className="text-primary-600 hover:text-primary-700 text-sm"
                      >
                        Задача #{depId} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <FileList
            entityType="workitem"
            entityId={taskId}
            projectId={task.project}
            showUploader={true}
          />
        )}

        {activeTab === 'comments' && (
          <CommentThread entityType="workitem" entityId={taskId} />
        )}

        {activeTab === 'activity' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Журнал по задаче</h2>
            <TaskActivityLog workitemId={taskId} />
          </div>
        )}

        {activeTab === 'maps' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Ментальные карты</h2>
              <Link
                to={`/mindmaps/new?workitem_id=${taskId}`}
                className="px-3 py-1.5 rounded-lg bg-imperial-gold text-imperial-bg text-sm font-medium hover:opacity-90"
              >
                Create Mind Map
              </Link>
            </div>
            <ul className="space-y-2">
              {(taskMaps as { id: number; title: string; updated_at: string }[]).map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/mindmaps/${m.id}?workitem_id=${taskId}`}
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
            {(taskMaps as unknown[]).length === 0 && (
              <p className="text-slate-500 dark:text-slate-400">Нет карт. Создайте первую по кнопке выше.</p>
            )}
          </div>
        )}
      </div>

      <TaskModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        task={task}
        projects={projects}
      />
    </div>
  );
}
