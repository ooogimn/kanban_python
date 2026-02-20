import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '../api/todo';
import { Project } from '../types';
import ProjectForm from './ProjectForm';
import toast from 'react-hot-toast';

/** Достаёт текст ошибки из ответа API (в т.ч. по полю logo — формат/размер). */
function getApiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  const d = data as Record<string, unknown>;
  if (typeof d.detail === 'string') return d.detail;
  if (Array.isArray(d.detail) && d.detail[0]) return String(d.detail[0]);
  const logo = d.logo;
  if (Array.isArray(logo) && logo[0]) return String(logo[0]);
  if (typeof logo === 'string') return logo;
  const name = d.name;
  if (Array.isArray(name) && name[0]) return String(name[0]);
  const first = Object.values(d).flat().find((v) => typeof v === 'string' || (Array.isArray(v) && v[0]));
  if (Array.isArray(first) && first[0]) return String(first[0]);
  if (typeof first === 'string') return first;
  return fallback;
}

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
  workspaceId?: number;
  onSuccess?: (project: Project) => void;
}

export default function ProjectModal({
  isOpen,
  onClose,
  project,
  workspaceId,
  onSuccess,
}: ProjectModalProps) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof todoApi.createProject>[0]) => todoApi.createProject(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Проект создан');
      onSuccess?.(data);
      onClose();
    },
    onError: (err: unknown) => {
      const msg = getApiErrorMessage(err, 'Ошибка при создании проекта');
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof todoApi.updateProject>[1] }) =>
      todoApi.updateProject(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
      queryClient.invalidateQueries({ queryKey: ['project-budget', data.id] });
      toast.success('Проект обновлён');
      onSuccess?.(data);
      onClose();
    },
    onError: (err: unknown) => {
      const msg = getApiErrorMessage(err, 'Ошибка при обновлении проекта');
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => todoApi.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Проект удалён');
      onClose();
    },
    onError: () => {
      toast.error('Ошибка при удалении проекта');
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleSubmit = (data: Partial<Project> & { name: string; status: string }, logoFile?: File) => {
    if (logoFile) {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('description', data.description ?? '');
      formData.append('status', data.status);
      if (data.start_date) formData.append('start_date', data.start_date);
      if (data.end_date) formData.append('end_date', data.end_date);
      if (data.budget != null) formData.append('budget', String(data.budget));
      if (!project && data.workspace) formData.append('workspace', String(data.workspace));
      formData.append('logo', logoFile);
      if (project) {
        updateMutation.mutate({ id: project.id, data: formData });
      } else {
        createMutation.mutate(formData as Parameters<typeof todoApi.createProject>[0]);
      }
    } else {
      if (project) {
        updateMutation.mutate({ id: project.id, data });
      } else {
        createMutation.mutate(data as Parameters<typeof todoApi.createProject>[0]);
      }
    }
  };

  const handleDelete = () => {
    if (!project) return;
    if (window.confirm(`Удалить проект «${project.name}»? Это действие нельзя отменить.`)) {
      deleteMutation.mutate(project.id);
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
            {project ? 'Редактировать проект' : 'Новый проект'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
            ✕
          </button>
        </div>
        <div className="p-6">
          <ProjectForm
            project={project}
            workspaceId={workspaceId}
            onSubmit={handleSubmit}
            onCancel={onClose}
            isSubmitting={isSubmitting}
            submitLabel={project ? 'Сохранить' : 'Создать'}
          />
          {project && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
              >
                Удалить проект
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
