import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '../api/todo';
import { documentsApi } from '../api/documents';
import { WikiPage } from '../types';
import { WikiPageEditor, WikiTree } from '../components/documents';
import toast from 'react-hot-toast';

function CreateTaskFromWikiButton({ wikiPageId }: { wikiPageId: number }) {
  const navigate = useNavigate();
  const createTaskMutation = useMutation({
    mutationFn: () => documentsApi.createTaskFromWikiPage(wikiPageId),
    onSuccess: (task) => {
      toast.success('Задача создана');
      navigate(`/tasks?highlight=${task.id}`);
    },
    onError: () => toast.error('Ошибка при создании задачи'),
  });
  return (
    <button
      type="button"
      onClick={() => createTaskMutation.mutate()}
      disabled={createTaskMutation.isPending}
      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
    >
      {createTaskMutation.isPending ? 'Создание…' : '+ Создать задачу'}
    </button>
  );
}

export default function WikiPageViewPage() {
  const { id, pageId } = useParams<{ id: string; pageId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projectId = id ? Number(id) : 0;
  const isNewPage = pageId === 'new';
  const wikiPageId = isNewPage ? 0 : (pageId ? Number(pageId) : 0);
  const parentIdParam = searchParams.get('parent');
  const parentIdForNew = parentIdParam ? Number(parentIdParam) : undefined;
  const [isEditing, setIsEditing] = useState(false);

  // Открыть редактор справа, если в URL ?edit=1 (например, по клику на ✏️ в дереве)
  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      setIsEditing(true);
    }
  }, [wikiPageId, searchParams]);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => todoApi.getProject(projectId),
    enabled: projectId > 0,
  });

  const { data: page, isLoading } = useQuery({
    queryKey: ['wiki-page', wikiPageId],
    queryFn: () => documentsApi.getWikiPage(wikiPageId),
    enabled: !isNewPage && wikiPageId > 0,
  });

  if (!isNewPage && isLoading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  if (!isNewPage && !page) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Страница не найдена</p>
        <Link to={`/projects/${projectId}`} className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          ← К проекту
        </Link>
      </div>
    );
  }

  // Режим «Новая страница» — форма создания справа
  if (isNewPage) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-gray-500">
          <Link to="/projects" className="hover:text-gray-700">Проекты</Link>
          {' / '}
          <Link to={`/projects/${projectId}`} className="hover:text-gray-700">{project?.name ?? 'Проект'}</Link>
          {' / '}
          <Link to={`/projects/${projectId}?tab=wiki`} className="hover:text-gray-700">Записки</Link>
          {' / '}
          <span className="text-gray-900">Новая страница</span>
        </div>

        <div className="flex gap-6">
          <div className="w-64 flex-shrink-0">
            <div className="bg-white dark:bg-imperial-surface/80 dark:border dark:border-white/10 rounded-lg shadow p-4 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
              <Link
                to={`/projects/${projectId}?tab=wiki`}
                className="text-sm text-primary-600 hover:text-primary-700 mb-3 block"
              >
                ← К проекту
              </Link>
              <WikiTree projectId={projectId} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-white dark:bg-imperial-surface/80 dark:border dark:border-white/10 rounded-lg shadow p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Новая страница</h1>
              <WikiPageEditor
                projectId={projectId}
                parentId={parentIdForNew && parentIdForNew > 0 ? parentIdForNew : undefined}
                onSave={(newPage: WikiPage) => {
                  queryClient.invalidateQueries({ queryKey: ['wiki-tree', projectId] });
                  navigate(`/projects/${projectId}/wiki/page/${newPage.id}`);
                }}
                onCancel={() => navigate(`/projects/${projectId}?tab=wiki`)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Просмотр/редактирование существующей страницы
  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-500">
        <Link to="/projects" className="hover:text-gray-700">Проекты</Link>
        {' / '}
        <Link to={`/projects/${projectId}`} className="hover:text-gray-700">{project?.name ?? 'Проект'}</Link>
        {' / '}
        <Link to={`/projects/${projectId}?tab=wiki`} className="hover:text-gray-700">Записки</Link>
        {' / '}
        <span className="text-gray-900">{page!.title}</span>
      </div>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <div className="bg-white dark:bg-imperial-surface/80 dark:border dark:border-white/10 rounded-lg shadow p-4 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <Link
              to={`/projects/${projectId}?tab=wiki`}
              className="text-sm text-primary-600 hover:text-primary-700 mb-3 block"
            >
              ← К проекту
            </Link>
            <WikiTree projectId={projectId} currentPageId={wikiPageId} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-imperial-surface/80 dark:border dark:border-white/10 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{page!.title}</h1>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <CreateTaskFromWikiButton wikiPageId={wikiPageId} />
                )}
                {isEditing && (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                  >
                    Отмена
                  </button>
                )}
              </div>
            </div>

            {!isEditing ? (
              <div
                className="wiki-page-content prose prose-gray dark:prose-invert max-w-none text-gray-900 dark:text-slate-100"
                dangerouslySetInnerHTML={{ __html: page!.content || '<p class="text-gray-500 dark:text-slate-400">Нет содержимого.</p>' }}
              />
            ) : (
              <WikiPageEditor
                projectId={projectId}
                page={page!}
                onSave={() => {
                  queryClient.invalidateQueries({ queryKey: ['wiki-page', wikiPageId] });
                  queryClient.invalidateQueries({ queryKey: ['wiki-tree', projectId] });
                  setIsEditing(false);
                }}
                onCancel={() => setIsEditing(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
