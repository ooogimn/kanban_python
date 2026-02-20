import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api/documents';
import { WikiPage } from '../types';
import { WikiTree, WikiPageEditor } from '../components/documents';

export default function PersonalWikiPage() {
  const { pageId, rootId: rootIdParam } = useParams<{ pageId?: string; rootId?: string }>();
  const rootId = rootIdParam ? Number(rootIdParam) : undefined;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = pageId ? (pageId === 'new' ? 0 : Number(pageId)) : 0;
  const isNewPage = pageId === 'new';
  const noPageSelected = !pageId || (id === 0 && !isNewPage);
  const parentIdParam = searchParams.get('parent');
  const parentId = parentIdParam ? Number(parentIdParam) : undefined;
  const [isEditing, setIsEditing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const baseUrl = rootId ? `/documents/notebook/${rootId}` : '/documents';
  const backUrl = '/documents';

  useEffect(() => {
    if (searchParams.get('edit') === '1') setIsEditing(true);
  }, [pageId, searchParams]);

  const { data: page, isLoading } = useQuery({
    queryKey: ['wiki-page', id],
    queryFn: () => documentsApi.getWikiPage(id),
    enabled: !isNewPage && id > 0,
  });

  const { data: rootPageData } = useQuery({
    queryKey: ['wiki-page', rootId],
    queryFn: () => documentsApi.getWikiPage(rootId!),
    enabled: rootId != null && rootId > 0 && rootId !== id,
  });

  const sidebarCls = `shrink-0 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-imperial-surface/50 flex flex-col transition-[width] duration-200 ${sidebarCollapsed ? 'w-12' : 'w-64'}`;

  if (!isNewPage && id > 0 && isLoading) {
    return (
      <div className="flex min-h-[60vh]">
        <div className={sidebarCls}>
          {sidebarCollapsed ? (
            <button type="button" onClick={() => setSidebarCollapsed(false)} className="p-2 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-imperial-gold" title="Развернуть панель">▶</button>
          ) : (
            <>
              <div className="p-4 pb-0 flex items-center justify-end">
                <button type="button" onClick={() => setSidebarCollapsed(true)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" title="Свернуть панель">◀</button>
              </div>
              <div className="p-4 pt-2 overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
                <WikiTree scope="personal" rootId={rootId} />
              </div>
            </>
          )}
        </div>
        <div className="flex-1 p-6 flex items-center justify-center text-slate-500 dark:text-slate-400">
          Загрузка…
        </div>
      </div>
    );
  }

  if (!isNewPage && id > 0 && !page) {
    return (
      <div className="flex min-h-[60vh]">
        <div className={sidebarCls}>
          {sidebarCollapsed ? (
            <button type="button" onClick={() => setSidebarCollapsed(false)} className="p-2 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-imperial-gold" title="Развернуть панель">▶</button>
          ) : (
            <>
              <div className="p-4 pb-0 flex items-center justify-end">
                <button type="button" onClick={() => setSidebarCollapsed(true)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" title="Свернуть панель">◀</button>
              </div>
              <div className="p-4 pt-2 overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
                <WikiTree scope="personal" rootId={rootId} />
              </div>
            </>
          )}
        </div>
        <div className="flex-1 p-6">
          <p className="text-slate-500 dark:text-slate-400">Записка не найдена.</p>
          <Link to={backUrl} className="text-primary-600 dark:text-imperial-gold hover:underline mt-2 inline-block">
            ← К документам
          </Link>
        </div>
      </div>
    );
  }

  // Список без выбранной страницы (внутри блокнота или legacy /documents)
  if (noPageSelected) {
    return (
      <div className="flex min-h-[60vh]">
        <div className={sidebarCls}>
          {sidebarCollapsed ? (
            <button type="button" onClick={() => setSidebarCollapsed(false)} className="p-2 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-imperial-gold" title="Развернуть панель">▶</button>
          ) : (
            <>
              <div className="p-4 pb-0 flex items-center justify-between gap-1">
                <Link to={backUrl} className="text-sm text-primary-600 dark:text-imperial-gold hover:underline">
                  ← Документы
                </Link>
                <button type="button" onClick={() => setSidebarCollapsed(true)} className="shrink-0 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" title="Свернуть панель">◀</button>
              </div>
              <div className="p-4 pt-2 overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
                <WikiTree scope="personal" rootId={rootId} />
              </div>
            </>
          )}
        </div>
        <div className="flex-1 p-6 flex items-center justify-center text-slate-500 dark:text-slate-400">
          <p>Выберите страницу слева или создайте новую.</p>
        </div>
      </div>
    );
  }

  // Режим «Новая страница»
  if (isNewPage) {
    return (
      <div className="flex min-h-[60vh]">
        <div className={sidebarCls}>
          {sidebarCollapsed ? (
            <button type="button" onClick={() => setSidebarCollapsed(false)} className="p-2 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-imperial-gold" title="Развернуть панель">▶</button>
          ) : (
            <>
              <div className="p-4 pb-0 flex items-center justify-between gap-1">
                <Link to={baseUrl} className="text-sm text-primary-600 dark:text-imperial-gold hover:underline">
                  ← {rootId ? 'Блокнот' : 'Документы'}
                </Link>
                <button type="button" onClick={() => setSidebarCollapsed(true)} className="shrink-0 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" title="Свернуть панель">◀</button>
              </div>
              <div className="p-4 pt-2 overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
                <WikiTree scope="personal" rootId={rootId} />
              </div>
            </>
          )}
        </div>
        <div className="flex-1 min-w-0 p-6 overflow-auto">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Новая страница</h1>
            <WikiPageEditor
              parentId={parentId && parentId > 0 ? parentId : undefined}
              onSave={(newPage: WikiPage) => {
                queryClient.invalidateQueries({ queryKey: ['wiki-tree', 'personal'] });
                navigate(rootId ? `${baseUrl}/page/${newPage.id}` : `/documents/page/${newPage.id}`);
              }}
              onCancel={() => navigate(baseUrl)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Просмотр/редактирование существующей
  return (
    <div className="flex min-h-[60vh]">
      <div className={sidebarCls}>
        {sidebarCollapsed ? (
          <button type="button" onClick={() => setSidebarCollapsed(false)} className="p-2 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-imperial-gold" title="Развернуть панель">▶</button>
        ) : (
          <>
            <div className="p-4 pb-0 flex items-center justify-between gap-1 sticky top-0 bg-white dark:bg-imperial-surface/50 z-10">
              <Link to={baseUrl} className="text-sm text-primary-600 dark:text-imperial-gold hover:underline">
                ← {rootId ? 'Блокнот' : 'Документы'}
              </Link>
              <button type="button" onClick={() => setSidebarCollapsed(true)} className="shrink-0 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" title="Свернуть панель">◀</button>
            </div>
            <div className="p-4 pt-2 overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
              <WikiTree scope="personal" rootId={rootId} currentPageId={id} />
            </div>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{page!.title}</h1>
          </div>

          {!isEditing ? (
            <div
              className="wiki-page-content prose prose-slate dark:prose-invert max-w-none text-slate-900 dark:text-slate-100"
              dangerouslySetInnerHTML={{
                __html: page!.content || '<p class="text-slate-500">Нет содержимого.</p>',
              }}
            />
          ) : (
            <WikiPageEditor
              page={page}
              rootPage={rootId != null ? (id === rootId ? page ?? undefined : rootPageData) : undefined}
              onSave={(updated) => {
                queryClient.invalidateQueries({ queryKey: ['wiki-page', id] });
                queryClient.invalidateQueries({ queryKey: ['wiki-tree', 'personal'] });
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
