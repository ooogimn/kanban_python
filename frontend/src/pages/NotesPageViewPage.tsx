import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api/documents';
import toast from 'react-hot-toast';

export default function NotesPageViewPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = pageId ? Number(pageId) : 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editWorkitemId, setEditWorkitemId] = useState<string>('');

  const { data: page, isLoading } = useQuery({
    queryKey: ['wiki-page', id],
    queryFn: () => documentsApi.getWikiPage(id),
    enabled: id > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { title: string; content?: string; workitem?: number | null }) =>
      documentsApi.updateWikiPage(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-page', id] });
      queryClient.invalidateQueries({ queryKey: ['wiki-pages'] });
      toast.success('Записка сохранена');
      setIsEditing(false);
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  if (id <= 0 || isLoading) {
    return (
      <div className="p-6">
        {isLoading ? 'Загрузка…' : 'Неверный идентификатор записки.'}
        <Link to="/notes" className="ml-2 text-primary-600 hover:underline">К запискам</Link>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Записка не найдена.</p>
        <Link to="/notes" className="text-primary-600 hover:underline mt-2 inline-block">К запискам</Link>
      </div>
    );
  }

  if (page.project) {
    navigate(`/projects/${page.project}/wiki/page/${id}`, { replace: true });
    return null;
  }

  const startEdit = () => {
    setEditTitle(page.title);
    setEditContent(page.content || '');
    setEditWorkitemId(page.workitem ? String(page.workitem) : '');
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const t = editTitle.trim();
    if (!t) return;
    const workitemId = editWorkitemId.trim() ? Number(editWorkitemId) : null;
    updateMutation.mutate({ title: t, content: editContent, workitem: workitemId ?? undefined });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        <Link to="/notes" className="hover:text-primary-600">← Все записки</Link>
      </div>
      {!isEditing ? (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{page.title}</h1>
            <button
              type="button"
              onClick={startEdit}
              className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              Редактировать
            </button>
          </div>
          <div
            className="prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: page.content || '<p class="text-slate-500">Нет содержимого.</p>' }}
          />
        </>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Название</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Содержимое</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Привязать к задаче (ID)</label>
            <input
              type="text"
              value={editWorkitemId}
              onChange={(e) => setEditWorkitemId(e.target.value)}
              placeholder="Оставьте пустым или укажите ID задачи"
              className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updateMutation.isPending || !editTitle.trim()}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
