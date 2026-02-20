import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../api/workspace';
import { Workspace } from '../types';
import WorkspaceForm from './WorkspaceForm';
import toast from 'react-hot-toast';

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

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace?: Workspace | null;
  onSuccess?: (workspace: Workspace) => void;
}

export default function WorkspaceModal({
  isOpen,
  onClose,
  workspace,
  onSuccess,
}: WorkspaceModalProps) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof workspaceApi.createWorkspace>[0]) => workspaceApi.createWorkspace(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-current'] });
      toast.success('Пространство создано');
      onSuccess?.(data);
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Ошибка при создании пространства'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof workspaceApi.updateWorkspace>[1] }) =>
      workspaceApi.updateWorkspace(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspace', data.id] });
      toast.success('Пространство обновлено');
      onSuccess?.(data);
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Ошибка при обновлении пространства'));
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (data: Partial<Workspace> & { name: string }, logoFile?: File) => {
    if (logoFile) {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('description', data.description ?? '');
      formData.append('logo', logoFile);
      if (workspace) {
        updateMutation.mutate({ id: workspace.id, data: formData });
      } else {
        createMutation.mutate(formData as Parameters<typeof workspaceApi.createWorkspace>[0]);
      }
    } else {
      if (workspace) {
        updateMutation.mutate({ id: workspace.id, data });
      } else {
        createMutation.mutate(data as Parameters<typeof workspaceApi.createWorkspace>[0]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {workspace ? 'Редактировать пространство' : 'Новое пространство'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="p-6">
          <WorkspaceForm
            workspace={workspace}
            onSubmit={handleSubmit}
            onCancel={onClose}
            isSubmitting={isSubmitting}
            submitLabel={workspace ? 'Сохранить' : 'Создать'}
          />
        </div>
      </div>
    </div>
  );
}
