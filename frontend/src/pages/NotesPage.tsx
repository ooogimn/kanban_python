import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { documentsApi } from '../api/documents';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import { WikiPage } from '../types';
import { CreateNoteModal } from '../components/documents';

interface WorkspaceMemberWithUser {
  user?: { id: number; username?: string; first_name?: string; last_name?: string };
}

function authorLabel(m: WorkspaceMemberWithUser): string {
  const u = m.user;
  if (!u) return '';
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  return name || u.username || `User ${u.id}`;
}

export default function NotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectFilter, setProjectFilter] = useState<number | ''>(() => {
    const p = searchParams.get('project');
    return p ? Number(p) : '';
  });
  const [authorFilter, setAuthorFilter] = useState<number | ''>(() => {
    const a = searchParams.get('author');
    return a ? Number(a) : '';
  });
  const [taskFilter, setTaskFilter] = useState<number | ''>(() => {
    const t = searchParams.get('task');
    return t ? Number(t) : '';
  });
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [createNoteOpen, setCreateNoteOpen] = useState(false);

  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });

  const { data: projectsRes } = useQuery({
    queryKey: ['projects', currentWorkspace?.id],
    queryFn: () => todoApi.getProjects({ workspace_id: currentWorkspace!.id }),
    enabled: !!currentWorkspace?.id,
  });
  const projects = projectsRes?.results ?? [];

  const { data: members } = useQuery({
    queryKey: ['workspace-members', currentWorkspace?.id],
    queryFn: () => workspaceApi.getWorkspaceMembers(currentWorkspace!.id),
    enabled: !!currentWorkspace?.id,
  });
  const membersList = (Array.isArray(members) ? members : []) as WorkspaceMemberWithUser[];

  const { data: tasksRes } = useQuery({
    queryKey: ['tasks', projectFilter],
    queryFn: () => todoApi.getTasks({ project: projectFilter as number }),
    enabled: !!projectFilter,
  });
  const tasks = tasksRes?.results ?? [];

  const workspaceParams: {
    workspace_id?: number;
    project_id?: number;
    author?: number;
    workitem_id?: number;
    search?: string;
  } = {};
  if (currentWorkspace?.id) workspaceParams.workspace_id = currentWorkspace.id;
  if (projectFilter) workspaceParams.project_id = projectFilter;
  if (authorFilter) workspaceParams.author = authorFilter;
  if (taskFilter) workspaceParams.workitem_id = taskFilter;
  if (searchQuery.trim()) workspaceParams.search = searchQuery.trim();

  const { data: personalData, isLoading: personalLoading } = useQuery({
    queryKey: ['wiki-pages', 'personal', searchQuery.trim() || null],
    queryFn: () => documentsApi.getWikiPages({ scope: 'personal', search: searchQuery.trim() || undefined }),
    enabled: true,
  });
  const personalNotes: WikiPage[] = personalData?.results ?? [];

  const { data: workspaceNotesData, isLoading: workspaceLoading } = useQuery({
    queryKey: ['wiki-pages', workspaceParams],
    queryFn: () => documentsApi.getWikiPages(workspaceParams),
    enabled: !!currentWorkspace?.id,
  });
  const workspaceNotes: WikiPage[] = workspaceNotesData?.results ?? [];

  useEffect(() => {
    const next: Record<string, string> = {};
    if (projectFilter) next.project = String(projectFilter);
    if (authorFilter) next.author = String(authorFilter);
    if (taskFilter) next.task = String(taskFilter);
    if (searchQuery.trim()) next.search = searchQuery.trim();
    const current = Object.fromEntries(
      [...searchParams.entries()].filter(([k]) => ['project', 'author', 'task', 'search'].includes(k))
    );
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    setSearchParams(next, { replace: true });
  }, [projectFilter, authorFilter, taskFilter, searchQuery, searchParams, setSearchParams]);

  useEffect(() => {
    if (!projectFilter) setTaskFilter('');
  }, [projectFilter]);

  const isLoading = personalLoading || (!!currentWorkspace?.id && workspaceLoading);

  function noteLink(note: WikiPage) {
    if (note.project) return `/projects/${note.project}/wiki/page/${note.id}`;
    if (note.workspace == null) return `/documents/page/${note.id}`;
    return `/notes/page/${note.id}`;
  }
  function noteRow(note: WikiPage) {
    return (
      <li key={note.id}>
        <Link
          to={noteLink(note)}
          className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 block transition-colors"
        >
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">{note.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {note.project_name && (
                <span className="text-imperial-gold">{note.project_name}</span>
              )}
              {note.project_name && note.author && ' · '}
              {note.author && (
                <span>
                  {[note.author.first_name, note.author.last_name].filter(Boolean).join(' ') ||
                    note.author.username}
                </span>
              )}
              {' · '}
              {new Date(note.updated_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          <span className="text-imperial-gold text-sm shrink-0 ml-2">Открыть →</span>
        </Link>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Документы и Заметки</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {currentWorkspace?.id
              ? `Личные заметки и записки пространства «${currentWorkspace.name}». Создавайте без проекта, привязывайте позже.`
              : 'Создавайте личные заметки без воркспейса или выберите пространство для рабочих записок.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateNoteOpen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          Создать
        </button>
      </div>

      <CreateNoteModal
        isOpen={createNoteOpen}
        onClose={() => setCreateNoteOpen(false)}
        workspaceId={currentWorkspace?.id}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        onSuccess={() => {
          setCreateNoteOpen(false);
        }}
      />

      {/* Секция: Мои личные заметки */}
      <section className="bg-white dark:bg-imperial-surface/80 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <h2 className="px-4 py-3 text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10">
          Мои личные заметки
        </h2>
        {personalLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Загрузка...</div>
        ) : personalNotes.length === 0 ? (
          <div className="p-6 text-center text-slate-500 dark:text-slate-400">
            Нет личных записок. Нажмите «Создать» без выбора воркспейса или создайте записку в задаче.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {personalNotes.map((note) => noteRow(note))}
          </ul>
        )}
      </section>

      {/* Секция: Заметки пространства — только при выбранном воркспейсе */}
      {currentWorkspace?.id && (
        <>
          <div className="bg-white dark:bg-imperial-surface/80 rounded-xl border border-slate-200 dark:border-white/10 p-4 flex flex-wrap gap-4 items-end shadow-sm">
            <div className="min-w-0 flex-1 sm:min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Поиск</label>
              <input
                type="search"
                placeholder="Название или текст записки..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-imperial-gold/50 w-full bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="min-w-0 sm:min-w-[180px]">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Проект</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : '')}
                className="px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-imperial-gold/50 w-full bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
              >
                <option value="">Все проекты</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 sm:min-w-[180px]">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Участник</label>
              <select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value ? Number(e.target.value) : '')}
                className="px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-imperial-gold/50 w-full bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
              >
                <option value="">Все участники</option>
                {membersList.map((m) => (
                  <option key={m.user?.id} value={m.user?.id ?? ''}>
                    {authorLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 sm:min-w-[220px]">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Задача</label>
              <select
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value ? Number(e.target.value) : '')}
                disabled={!projectFilter}
                className="px-3 py-2 border border-slate-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-imperial-gold/50 w-full bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100 disabled:opacity-50"
              >
                <option value="">Все записки по задаче</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title.length > 50 ? t.title.slice(0, 50) + '…' : t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <section className="bg-white dark:bg-imperial-surface/80 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <h2 className="px-4 py-3 text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10">
              Заметки пространства
            </h2>
            {workspaceLoading ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">Загрузка...</div>
            ) : workspaceNotes.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                Нет записок в этом пространстве.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-white/10">
                {workspaceNotes.map((note) => noteRow(note))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
