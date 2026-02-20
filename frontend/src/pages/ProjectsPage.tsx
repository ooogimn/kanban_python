import { useState, useEffect, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import { Project } from '../types';
import { Link } from 'react-router-dom';
import ProjectModal from '../components/ProjectModal';

function getNextPageParam(nextUrl: string | null | undefined): number | undefined {
  if (!nextUrl) return undefined;
  const m = nextUrl.match(/[?&]page=(\d+)/);
  return m ? Number(m[1]) : undefined;
}

export default function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });

  const {
    data: projectsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['projects', currentWorkspace?.id, search.trim() || null, statusFilter || null],
    queryFn: ({ pageParam = 1 }) =>
      todoApi.getProjects({
        ...(currentWorkspace?.id ? { workspace_id: currentWorkspace.id } : {}),
        page: pageParam,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    getNextPageParam: (lastPage) => getNextPageParam(lastPage.next),
    initialPageParam: 1,
  });

  const allProjects = useMemo(
    () => projectsData?.pages.flatMap((p) => p.results) ?? [],
    [projectsData?.pages]
  );

  if (isLoading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Проекты</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Управление проектами</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shrink-0"
        >
          + Новый проект
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Поиск по названию или описанию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg flex-1 min-w-0 max-w-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg w-full sm:w-auto bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        >
          <option value="">Все статусы</option>
          <option value="planning">Планирование</option>
          <option value="active">Активный</option>
          <option value="on_hold">На паузе</option>
          <option value="completed">Завершён</option>
          <option value="archived">В архиве</option>
        </select>
      </div>

      <ProjectModal
        isOpen={modalOpen || !!editProject}
        onClose={() => { setModalOpen(false); setEditProject(null); }}
        project={editProject ?? (modalOpen ? null : undefined)}
        workspaceId={currentWorkspace?.id}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={(e) => { e.preventDefault(); e.stopPropagation(); setEditProject(project); }}
          />
        ))}
      </div>

      {!allProjects.length && (
        <div className="text-center py-12 bg-white rounded-lg shadow dark:bg-slate-800 dark:shadow-none">
          <p className="text-gray-500 dark:text-slate-400">{search || statusFilter ? 'Ничего не найдено' : 'Нет проектов'}</p>
        </div>
      )}
      {hasNextPage && (
        <div className="text-center py-4">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Загрузка…' : 'Показать ещё'}
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onEdit }: { project: Project; onEdit?: (e: React.MouseEvent) => void }) {
  const statusColors: Record<string, string> = {
    planning: 'bg-slate-100 text-slate-800',
    active: 'bg-green-100 text-green-800',
    on_hold: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow relative group border border-slate-200 dark:border-slate-700">
      <Link to={`/projects/${project.id}`} className="block">
        <div className="flex items-start justify-between mb-4 pr-8 gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0 overflow-hidden flex items-center justify-center">
            {project.logo_url ? (
              <img src={project.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl text-slate-400">📁</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{project.name}</h3>
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full shrink-0 ${statusColors[project.status] || 'bg-gray-100 text-gray-800 dark:bg-slate-600 dark:text-slate-200'}`}
          >
            {project.status}
          </span>
        </div>
        {project.description && (
          <p className="text-gray-600 dark:text-slate-400 text-sm mb-4 line-clamp-2">{project.description}</p>
        )}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-slate-400">
          {project.start_date && (
            <span>Начало: {new Date(project.start_date).toLocaleDateString('ru-RU')}</span>
          )}
          {project.end_date && (
            <span>Конец: {new Date(project.end_date).toLocaleDateString('ru-RU')}</span>
          )}
        </div>
      </Link>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          title="Редактировать проект"
        >
          ✏️
        </button>
      )}
    </div>
  );
}
