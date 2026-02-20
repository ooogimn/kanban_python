import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../api/documents';
import toast from 'react-hot-toast';

interface ProjectOption {
  id: number;
  name: string;
}

interface CreateNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: number;
  defaultProjectId?: number | null;
  defaultWorkitemId?: number | null;
  projects?: ProjectOption[];
  onSuccess?: (noteId: number) => void;
}

export default function CreateNoteModal({
  isOpen,
  onClose,
  workspaceId,
  defaultProjectId,
  defaultWorkitemId,
  projects = [],
  onSuccess,
}: CreateNoteModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState<number | ''>(defaultProjectId ?? '');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setContent('');
      setProjectId(defaultProjectId ?? '');
    }
  }, [isOpen, defaultProjectId]);

  const createMutation = useMutation({
    mutationFn: (payload: { title: string; content?: string; project?: number; workitem?: number; workspace?: number }) =>
      documentsApi.createWikiPage(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wiki-pages'] });
      toast.success('Записка создана');
      onSuccess?.(data.id);
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string; workspace?: string[]; project?: string[] } } })?.response
          ?.data;
      const text =
        typeof msg?.detail === 'string'
          ? msg.detail
          : Array.isArray(msg?.workspace)
            ? msg.workspace.join(', ')
            : Array.isArray(msg?.project)
              ? msg.project.join(', ')
              : msg && typeof msg === 'object' && !Array.isArray(msg)
                ? JSON.stringify(msg)
                : 'Не удалось создать записку';
      toast.error(text);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      toast.error('Введите название записки');
      return;
    }
    createMutation.mutate({
      title: t,
      content: content.trim() || undefined,
      project: projectId ? Number(projectId) : undefined,
      workitem: defaultWorkitemId ?? undefined,
      // workspace не передаём: бэкенд создаёт личную заметку при отсутствии project
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-imperial-surface rounded-lg shadow-xl w-full max-w-md border border-slate-200 dark:border-white/10 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Создать записку</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Записку можно создать без проекта и задачи, затем привязать к задаче или проекту.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Название *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
              placeholder="Название записки"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Текст (необязательно)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
              placeholder="Содержимое записки"
            />
          </div>
          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Проект (необязательно)</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
              >
                <option value="">Без проекта</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {defaultWorkitemId && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Записка будет привязана к выбранной задаче.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !title.trim()}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
