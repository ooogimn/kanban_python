import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../api/documents';
import { WikiPage } from '../../types';
import toast from 'react-hot-toast';

interface AttachNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workitemId: number;
  projectId: number;
  onAttached?: () => void;
}

export default function AttachNoteModal({
  isOpen,
  onClose,
  workitemId,
  projectId,
  onAttached,
}: AttachNoteModalProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wiki-pages', 'personal'],
    queryFn: () => documentsApi.getWikiPages({ scope: 'personal' }),
    enabled: isOpen,
  });

  const attachMutation = useMutation({
    mutationFn: (pageId: number) =>
      documentsApi.patchWikiPage(pageId, {
        workitem: workitemId,
        project: projectId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-pages'] });
      toast.success('Записка привязана к задаче');
      onAttached?.();
      onClose();
    },
    onError: () => {
      toast.error('Не удалось привязать записку');
    },
  });

  const personalNotes: WikiPage[] = data?.results ?? [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-imperial-surface rounded-lg shadow-xl w-full max-w-md border border-slate-200 dark:border-white/10 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Прикрепить существующую записку
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Выберите личную записку — она будет привязана к этой задаче и к проекту.
        </p>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Загрузка…</p>
        ) : personalNotes.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Нет личных записок. Создайте записку без проекта, затем привяжите её здесь.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-white/10 max-h-64 overflow-y-auto">
            {personalNotes.map((note) => (
              <li key={note.id} className="py-2">
                <button
                  type="button"
                  onClick={() => attachMutation.mutate(note.id)}
                  disabled={attachMutation.isPending}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-primary-600 dark:text-imperial-gold font-medium disabled:opacity-50"
                >
                  {note.title || `Запись #${note.id}`}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end mt-3 pt-2 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
