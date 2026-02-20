import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api/documents';
import { workspaceApi } from '../api/workspace';
import { todoApi } from '../api/todo';
import { WikiPage } from '../types';
import toast from 'react-hot-toast';
import { FileText, FolderOpen, StickyNote, Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';

const NOTEBOOK_COLORS = [
  '',
  '#3788d8',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#64748b',
];

const TABS = [
  { id: 'notebooks', label: 'Блокноты', icon: FolderOpen, href: '/documents' },
  { id: 'files', label: 'Файлы', icon: FileText, href: '/documents/files' },
  { id: 'notes', label: 'Заметки', icon: StickyNote, href: '/documents/notes' },
] as const;

export default function DocumentsHubPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'notebooks' | 'files' | 'notes'>('notebooks');
  const [menuNotebookId, setMenuNotebookId] = useState<number | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [formWorkspaceId, setFormWorkspaceId] = useState<number | ''>('');
  const [formProjectId, setFormProjectId] = useState<number | ''>('');
  const [formWorkitemId, setFormWorkitemId] = useState<number | ''>('');
  const [formColor, setFormColor] = useState<string>('');

  useEffect(() => {
    if (location.pathname === '/documents/files') setActiveTab('files');
    else if (location.pathname === '/documents/notes') setActiveTab('notes');
    else if (location.pathname === '/documents' || location.pathname.startsWith('/documents/notebook')) setActiveTab('notebooks');
  }, [location.pathname]);

  const { data: tree = [], isLoading } = useQuery({
    queryKey: ['wiki-tree', 'personal'],
    queryFn: () => documentsApi.getWikiTreePersonal(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<WikiPage>) => documentsApi.createWikiPage(data),
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['wiki-pages', 'personal'] });
      toast.success('Блокнот создан');
      navigate(`/documents/notebook/${newPage.id}`);
    },
    onError: () => toast.error('Ошибка при создании блокнота'),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WikiPage> }) =>
      documentsApi.patchWikiPage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['wiki-pages', 'personal'] });
      toast.success('Настройки блокнота сохранены');
      setMenuNotebookId(null);
      setShowRenameInput(false);
    },
    onError: () => toast.error('Ошибка при переименовании'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentsApi.deleteWikiPage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['wiki-pages', 'personal'] });
      toast.success('Блокнот удалён');
      setMenuNotebookId(null);
      setShowRenameInput(false);
    },
    onError: () => toast.error('Ошибка при удалении блокнота'),
  });

  const blocknots = tree as WikiPage[];
  const menuNotebook = menuNotebookId != null ? blocknots.find((r) => r.id === menuNotebookId) : null;

  useEffect(() => {
    if (menuNotebook) {
      setFormWorkspaceId(menuNotebook.workspace ?? '');
      setFormProjectId(menuNotebook.project ?? '');
      setFormWorkitemId(menuNotebook.workitem ?? '');
      setFormColor(menuNotebook.color ?? '');
    }
  }, [menuNotebook]);

  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getWorkspaces(),
    enabled: menuNotebook != null,
  });
  const workspaces = workspacesData?.results ?? [];

  const { data: workspaceProjectsData } = useQuery({
    queryKey: ['workspace-projects', formWorkspaceId],
    queryFn: () => workspaceApi.getWorkspaceProjects(formWorkspaceId as number),
    enabled: menuNotebook != null && formWorkspaceId !== '',
  });
  const workspaceProjects = Array.isArray(workspaceProjectsData) ? workspaceProjectsData : (workspaceProjectsData as { results?: unknown[] })?.results ?? [];

  const { data: projectTasksData } = useQuery({
    queryKey: ['project-tasks', formProjectId],
    queryFn: () => todoApi.getTasks({ project: formProjectId as number }),
    enabled: menuNotebook != null && formProjectId !== '',
  });
  const projectTasks = projectTasksData?.results ?? [];

  /** Количество всех страниц в дереве (корень + все подстраницы) */
  const countTreePages = (node: WikiPage): number => {
    let n = 1;
    if (node.children?.length) {
      for (const child of node.children) {
        n += countTreePages(child);
      }
    }
    return n;
  };

  const handleCreateNotebook = () => {
    createMutation.mutate({
      title: 'Новый блокнот',
      content: '',
      slug: `notebook-${Date.now()}`,
      parent: undefined,
    });
  };

  const openNotebookMenu = (e: React.MouseEvent, root: WikiPage) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuNotebookId(root.id);
    setRenameTitle(root.title);
    setShowRenameInput(false);
  };

  const closeNotebookMenu = () => {
    setMenuNotebookId(null);
    setShowRenameInput(false);
  };

  const handleRenameSubmit = () => {
    if (menuNotebookId == null || !renameTitle.trim()) return;
    patchMutation.mutate({ id: menuNotebookId, data: { title: renameTitle.trim() } });
  };

  const handleDeleteNotebook = () => {
    if (menuNotebookId == null) return;
    if (!confirm(`Удалить блокнот «${menuNotebook?.title}» и все его страницы?`)) return;
    deleteMutation.mutate(menuNotebookId);
  };

  const handleSaveBelongingAndColor = () => {
    if (menuNotebookId == null) return;
    const payload: Partial<WikiPage> = {
      workspace: formWorkspaceId === '' ? null : formWorkspaceId,
      project: formProjectId === '' ? null : formProjectId,
      workitem: formWorkitemId === '' ? null : formWorkitemId,
      color: formColor.trim() || undefined,
    };
    patchMutation.mutate({ id: menuNotebookId, data: payload });
  };

  return (
    <div className="min-h-[60vh] flex flex-col">
      <div className="border-b border-slate-200 dark:border-white/10 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Документы</h1>
        <nav className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon, href }) => (
            <Link
              key={id}
              to={href}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === id
                  ? 'bg-white dark:bg-imperial-surface/80 text-imperial-gold border border-b-0 border-slate-200 dark:border-white/10 -mb-px'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-white/5'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {activeTab === 'notebooks' && location.pathname === '/documents' && (
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4 mb-6">
            <p className="text-slate-600 dark:text-slate-400">
              Каждый блокнот — отдельное дерево страниц. Выберите блокнот или создайте новый.
            </p>
            <button
              type="button"
              onClick={handleCreateNotebook}
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              Создать блокнот
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">Загрузка…</div>
          ) : blocknots.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-imperial-surface/50 p-12 text-center">
              <p className="text-slate-600 dark:text-slate-400 mb-4">Нет блокнотов. Создайте первый.</p>
              <button
                type="button"
                onClick={handleCreateNotebook}
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-primary-600 text-white font-medium hover:bg-primary-700"
              >
                <Plus className="w-3 h-3" />
                Создать блокнот
              </button>
            </div>
          ) : (
            <>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {blocknots.map((root) => {
                  const accentColor = root.color && /^#[0-9A-Fa-f]{6}$/.test(root.color) ? root.color : null;
                  return (
                    <li key={root.id} className="relative">
                      <Link
                        to={`/documents/notebook/${root.id}`}
                        className={`block p-4 pr-10 rounded-xl border-2 bg-white dark:bg-imperial-surface/80 transition-all ${accentColor ? '' : 'border-slate-200 dark:border-white/10 hover:border-imperial-gold/50 hover:shadow-md'
                          }`}
                        style={
                          accentColor
                            ? {
                              borderColor: accentColor,
                              boxShadow: `0 0 14px ${accentColor}, 0 0 28px ${accentColor}99, 0 0 42px ${accentColor}66`,
                            }
                            : undefined
                        }
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{root.title}</span>
                        <span className="block text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {countTreePages(root)} страниц
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => openNotebookMenu(e, root)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-colors"
                        title="Настройки блокнота"
                        aria-label="Меню настроек блокнота"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Модальное окно: меню настроек блокнота */}
              {menuNotebook != null && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
                  onClick={closeNotebookMenu}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="notebook-menu-title"
                >
                  <div
                    className="bg-white dark:bg-imperial-surface border border-slate-200 dark:border-white/10 rounded-xl shadow-xl max-w-sm w-full p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 id="notebook-menu-title" className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                      Настройки блокнота
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 truncate" title={menuNotebook.title}>
                      {menuNotebook.title}
                    </p>

                    {showRenameInput ? (
                      <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Новое название
                        </label>
                        <input
                          type="text"
                          value={renameTitle}
                          onChange={(e) => setRenameTitle(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          placeholder="Название блокнота"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleRenameSubmit}
                            disabled={!renameTitle.trim() || patchMutation.isPending}
                            className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRenameInput(false)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 text-sm"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 mb-4">
                        <button
                          type="button"
                          onClick={() => setShowRenameInput(true)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                          <Pencil className="w-4 h-4 shrink-0" />
                          Переименовать
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteNotebook}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                          Удалить блокнот
                        </button>
                      </div>
                    )}

                    {/* Принадлежность: пространство, проект, задача */}
                    <div className="border-t border-slate-200 dark:border-white/10 pt-3 mt-3 space-y-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Принадлежность</p>
                      <label className="block text-xs text-slate-500 dark:text-slate-400">
                        Пространство
                      </label>
                      <select
                        value={formWorkspaceId === '' ? '' : formWorkspaceId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormWorkspaceId(v === '' ? '' : Number(v));
                          setFormProjectId('');
                          setFormWorkitemId('');
                        }}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                      >
                        <option value="">Личный (без привязки)</option>
                        {workspaces.map((ws: { id: number; name: string }) => (
                          <option key={ws.id} value={ws.id}>{ws.name}</option>
                        ))}
                      </select>
                      {formWorkspaceId !== '' && (
                        <>
                          <label className="block text-xs text-slate-500 dark:text-slate-400">Проект</label>
                          <select
                            value={formProjectId === '' ? '' : formProjectId}
                            onChange={(e) => {
                              const v = e.target.value;
                              setFormProjectId(v === '' ? '' : Number(v));
                              setFormWorkitemId('');
                            }}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                          >
                            <option value="">— не выбран —</option>
                            {workspaceProjects.map((p: { id: number; name: string }) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </>
                      )}
                      {formProjectId !== '' && (
                        <>
                          <label className="block text-xs text-slate-500 dark:text-slate-400">Задача</label>
                          <select
                            value={formWorkitemId === '' ? '' : formWorkitemId}
                            onChange={(e) => setFormWorkitemId(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                          >
                            <option value="">— не выбрана —</option>
                            {projectTasks.map((t: { id: number; title: string }) => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>

                    {/* Цвет блокнота */}
                    <div className="border-t border-slate-200 dark:border-white/10 pt-3 mt-3">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Цвет</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        {NOTEBOOK_COLORS.map((hex) => (
                          <button
                            key={hex || 'none'}
                            type="button"
                            onClick={() => setFormColor(hex)}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${(hex === '' && formColor === '') || (hex !== '' && formColor === hex)
                                ? 'border-primary-600 dark:border-imperial-gold ring-2 ring-offset-2 ring-primary-500 dark:ring-imperial-gold'
                                : 'border-slate-300 dark:border-white/20 hover:border-slate-400'
                              }`}
                            style={hex ? { backgroundColor: hex } : { backgroundColor: 'var(--tw-slate-200)' }}
                            title={hex ? hex : 'Без цвета'}
                          />
                        ))}
                        <input
                          type="color"
                          value={formColor && /^#[0-9A-Fa-f]{6}$/.test(formColor) ? formColor : '#3788d8'}
                          onChange={(e) => setFormColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-slate-300 dark:border-white/20"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveBelongingAndColor}
                      disabled={patchMutation.isPending}
                      className="w-full mt-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                    >
                      Применить привязку и цвет
                    </button>

                    <button
                      type="button"
                      onClick={closeNotebookMenu}
                      className="w-full py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 text-sm"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'files' && location.pathname === '/documents/files' && (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-imperial-surface/50 p-6">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Файлы, прикреплённые к страницам блокнотов и задачам. Полный список — в задачах и на страницах.
          </p>
          <Link
            to="/notes"
            className="text-primary-600 dark:text-imperial-gold hover:underline"
          >
            Перейти к заметкам (список всех записей) →
          </Link>
        </div>
      )}

      {activeTab === 'notes' && location.pathname === '/documents/notes' && (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-imperial-surface/50 p-6">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Все ваши заметки и записи пространства в одном списке с фильтрами.
          </p>
          <Link
            to="/notes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700"
          >
            Открыть раздел «Заметки»
          </Link>
        </div>
      )}
    </div>
  );
}
