import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../api/documents';
import { WikiPage } from '../../types';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const STORAGE_KEY_PREFIX = 'wiki-tree-expanded-';

function loadExpanded(scopeKey: string): Set<number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PREFIX + scopeKey);
    if (raw) {
      const arr = JSON.parse(raw) as number[];
      return new Set(Array.isArray(arr) ? arr : []);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveExpanded(scopeKey: string, set: Set<number>) {
  try {
    sessionStorage.setItem(STORAGE_KEY_PREFIX + scopeKey, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

interface WikiTreeProps {
  /** ID проекта (для дерева проекта). Не задан при scope='personal'. */
  projectId?: number;
  /** 'personal' — дерево личных заметок (запрос personal/tree, ссылки на /documents/page/:id) */
  scope?: 'personal';
  /** При scope='personal': показывать только этот блокнот (корень дерева). Не задан — все корни. */
  rootId?: number;
  /** Подсветка текущей страницы */
  currentPageId?: number;
}

export default function WikiTree({ projectId, scope, currentPageId, rootId }: WikiTreeProps) {
  const queryClient = useQueryClient();
  const scopeKey = scope === 'personal' ? (rootId ? `personal-root-${rootId}` : 'personal') : `project-${projectId ?? 0}`;
  const [expandedPages, setExpandedPages] = useState<Set<number>>(() => loadExpanded(scopeKey));

  useEffect(() => {
    setExpandedPages(loadExpanded(scopeKey));
  }, [scopeKey]);

  const { data: tree, isLoading } = useQuery({
    queryKey: scope === 'personal' ? ['wiki-tree', 'personal'] : ['wiki-tree', projectId],
    queryFn: () =>
      scope === 'personal'
        ? documentsApi.getWikiTreePersonal()
        : documentsApi.getWikiTree(projectId!),
    enabled: scope === 'personal' || (projectId != null && projectId > 0),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentsApi.deleteWikiPage(id),
    onSuccess: () => {
      if (scope === 'personal') {
        queryClient.invalidateQueries({ queryKey: ['wiki-tree', 'personal'] });
        queryClient.invalidateQueries({ queryKey: ['wiki-pages', 'personal'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['wiki-tree', projectId] });
        queryClient.invalidateQueries({ queryKey: ['wiki-pages', projectId] });
      }
      toast.success('Страница удалена');
    },
    onError: () => {
      toast.error('Ошибка при удалении страницы');
    },
  });

  const toggleExpand = useCallback(
    (pageId: number) => {
      const newExpanded = new Set(expandedPages);
      if (newExpanded.has(pageId)) {
        newExpanded.delete(pageId);
      } else {
        newExpanded.add(pageId);
      }
      setExpandedPages(newExpanded);
      saveExpanded(scopeKey, newExpanded);
    },
    [scopeKey, expandedPages]
  );

  const pageUrl = (page: WikiPage) =>
    scope === 'personal'
      ? rootId
        ? `/documents/notebook/${rootId}/page/${page.id}`
        : `/documents/page/${page.id}`
      : `/projects/${projectId}/wiki/page/${page.id}`;
  const newPageUrl = (parentId: number) =>
    scope === 'personal'
      ? rootId
        ? `/documents/notebook/${rootId}/page/new${parentId > 0 ? `?parent=${parentId}` : ''}`
        : `/documents/page/new${parentId > 0 ? `?parent=${parentId}` : ''}`
      : `/projects/${projectId}/wiki/page/new${parentId > 0 ? `?parent=${parentId}` : ''}`;
  const renderPage = (page: WikiPage, level: number = 0) => {
    const hasChildren = page.children && page.children.length > 0;
    const isExpanded = expandedPages.has(page.id);
    const isCurrent = currentPageId != null && page.id === currentPageId;

    return (
      <div key={page.id} className={`text-xs ${level > 0 ? 'ml-3 mt-1' : ''}`}>
        <div className={`flex items-center space-x-1 p-1 rounded ${isCurrent ? 'bg-primary-50 dark:bg-white/10 ring-1 ring-primary-200' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
          {hasChildren && (
            <button
              onClick={() => toggleExpand(page.id)}
              className="text-gray-500 hover:text-gray-700 text-[10px] leading-none"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="w-3" />}

          <Link
            to={pageUrl(page)}
            className={`flex-none text-xs whitespace-nowrap ${isCurrent ? 'font-semibold text-primary-700 dark:text-imperial-gold' : 'text-gray-900 dark:text-slate-100 hover:text-primary-600'}`}
          >
            {page.title}
          </Link>

          <div className="flex items-center space-x-0.5 shrink-0 text-[7px]">
            {!page.is_published && (
              <span className="text-gray-400">(черн.)</span>
            )}
            <Link
              to={`${pageUrl(page)}?edit=1`}
              className="text-primary-600 hover:text-primary-700"
              title="Редактировать"
            >
              ✏️
            </Link>
            <Link
              to={newPageUrl(page.id)}
              className="text-gray-600 hover:text-gray-700"
              title="Создать подстраницу"
            >
              ➕
            </Link>
            <button
              onClick={() => {
                if (confirm(`Удалить страницу "${page.title}"?`)) {
                  deleteMutation.mutate(page.id);
                }
              }}
              className="text-red-600 hover:text-red-700"
              title="Удалить"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Дочерние страницы */}
        {hasChildren && isExpanded && (
          <div className="ml-2 border-l-2 border-gray-200 pl-1">
            {page.children!.map((child) => renderPage(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500">Загрузка...</div>;
  }

  const displayTree =
    scope === 'personal' && rootId && tree && tree.length > 0
      ? (tree as WikiPage[]).filter((r) => r.id === rootId)
      : (tree ?? []);

  return (
    <div className="space-y-4">
      {!rootId && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Записки</h2>
          <Link
            to={newPageUrl(0)}
            className="text-sm text-gray-600 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300"
            title="Создать запись"
          >
            ➕
          </Link>
        </div>
      )}

      {/* Дерево страниц */}
      {displayTree && displayTree.length > 0 ? (
        <div className="bg-white dark:bg-imperial-surface/80 dark:border dark:border-white/10 rounded-lg shadow p-2 text-xs overflow-x-auto min-w-0">
          {(displayTree as WikiPage[]).map((page) => renderPage(page))}
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-gray-500 dark:text-slate-400 bg-white dark:bg-imperial-surface/80 dark:border dark:border-white/10 rounded-lg">
          {rootId ? 'Нет страниц в этом блокноте. Добавьте первую.' : 'Нет записей. Создайте первую!'}
        </div>
      )}
    </div>
  );
}
