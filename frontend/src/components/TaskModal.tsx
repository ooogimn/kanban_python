import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { todoApi } from '../api/todo';
import { WorkItem, Project } from '../types';
import TaskForm from './TaskForm';
import TaskTimer from './TaskTimer';
import toast from 'react-hot-toast';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: WorkItem | null;
  projects: Project[];
  defaultProjectId?: number;
  onSuccess?: (task: WorkItem) => void;
}

export default function TaskModal({
  isOpen,
  onClose,
  task,
  projects,
  defaultProjectId,
  onSuccess,
}: TaskModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof todoApi.createTask>[0]) => todoApi.createTask(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-dashboard'] });
      toast.success('Задача создана');
      onSuccess?.(data);
      onClose();
      navigate(`/tasks/${data.id}`);
    },
    onError: () => {
      toast.error('Ошибка при создании задачи');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof todoApi.updateTask>[1] }) =>
      todoApi.updateTask(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['task', data.id] });
      toast.success('Задача обновлена');
      onSuccess?.(data);
      onClose();
    },
    onError: () => {
      toast.error('Ошибка при обновлении задачи');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => todoApi.completeTask(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['task', data.id] });
      toast.success('Задача завершена');
      onSuccess?.(data);
      onClose();
    },
    onError: () => {
      toast.error('Ошибка при завершении задачи');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => todoApi.cancelTask(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['task', data.id] });
      toast.success('Задача отменена');
      onSuccess?.(data);
      onClose();
    },
    onError: () => {
      toast.error('Ошибка при отмене задачи');
    },
  });

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending;

  const handleSubmit = (data: Partial<WorkItem>) => {
    if (task) {
      updateMutation.mutate({ id: task.id, data });
    } else {
      createMutation.mutate(data as Parameters<typeof todoApi.createTask>[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4 border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
            {task ? 'Редактировать задачу' : 'Новая задача'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
            ✕
          </button>
        </div>

        {/* Таймер — только для существующих задач */}
        {task && (
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <TaskTimer workitemId={task.id} />
          </div>
        )}

        <div className="p-6">
          <TaskForm
            task={task}
            projects={projects}
            defaultProjectId={defaultProjectId}
            onSubmit={handleSubmit}
            onCancel={onClose}
            onStart={task ? () => updateMutation.mutate({ id: task.id, data: { status: 'in_progress' } }) : undefined}
            onComplete={task ? () => completeMutation.mutate(task.id) : undefined}
            isSubmitting={isSubmitting}
            submitLabel={task ? 'Сохранить' : 'Создать'}
          />
          {task && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex flex-wrap gap-2">
              {task.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate(task.id)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 text-sm"
                >
                  Отменить задачу
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
