import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Maximize2, Minimize2, LayoutGrid, List } from 'lucide-react';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import { Project } from '../types';
import { Link } from 'react-router-dom';
import ProjectModal from '../components/ProjectModal';
import toast from 'react-hot-toast';
import { downloadCsv } from '../utils/exportCsv';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [exportLoading, setExportLoading] = useState<'jpg' | 'pdf' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

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

  const exportOptions = { pixelRatio: 2, cacheBust: true };
  const handleExportJpg = useCallback(() => {
    if (!pageRef.current) return;
    setExportLoading('jpg');
    toJpeg(pageRef.current, { ...exportOptions, quality: 0.95 })
      .then((dataUrl) => { const a = document.createElement('a'); a.href = dataUrl; a.download = `projects-${Date.now()}.jpg`; a.click(); toast.success('Сохранено в JPG'); })
      .catch(() => toast.error('Не удалось сохранить JPG'))
      .finally(() => setExportLoading(null));
  }, []);
  const handleExportPdf = useCallback(() => {
    if (!pageRef.current) return;
    setExportLoading('pdf');
    toPng(pageRef.current, exportOptions)
      .then((dataUrl) => {
        const img = new Image();
        img.onload = () => { const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width, img.height] }); pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height); pdf.save(`projects-${Date.now()}.pdf`); toast.success('Сохранено в PDF'); };
        img.src = dataUrl;
      })
      .catch(() => toast.error('Не удалось сохранить PDF'))
      .finally(() => setExportLoading(null));
  }, []);
  const handleExportExcel = useCallback(() => {
    const rows: (string | number)[][] = [['Название', 'Статус', 'Начало', 'Конец']];
    allProjects.forEach((p: Project) => rows.push([p.name ?? '', p.status ?? '', p.start_date ?? '', p.end_date ?? '']));
    downloadCsv(`projects-${Date.now()}.csv`, rows);
    toast.success('Сохранено в CSV');
  }, [allProjects]);
  const handleFullscreen = useCallback(() => {
    if (!pageRef.current) return;
    if (!document.fullscreenElement) pageRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => toast.error('Полный экран недоступен'));
    else document.exitFullscreen?.().then(() => setIsFullscreen(false));
  }, []);
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  if (isLoading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div ref={pageRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Проекты</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Управление проектами</p>
        </div>
        <div className="flex flex-nowrap items-center gap-1.5">
          <button type="button" onClick={() => setModalOpen(true)} title="Новый проект" className="px-2 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium text-xs">+</button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button type="button" onClick={handleExportJpg} disabled={!!exportLoading} className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs">JPG</button>
          <button type="button" onClick={handleExportPdf} disabled={!!exportLoading} className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs">PDF</button>
          <button type="button" onClick={handleExportExcel} className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs">Excel</button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button type="button" onClick={() => setViewMode('grid')} title="Сетка" className={`p-1.5 rounded-md border ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setViewMode('list')} title="Список" className={`p-1.5 rounded-md border ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><List className="w-3.5 h-3.5" /></button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button type="button" onClick={handleFullscreen} className="p-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700" title={isFullscreen ? 'Свернуть' : 'Во весь экран'}>{isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 p-2 flex flex-wrap gap-2 items-end">
        <div className="min-w-0 flex-1 sm:flex-initial sm:min-w-[170px]">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Поиск</label>
          <input type="search" placeholder="Название или описание..." value={search} onChange={(e) => setSearch(e.target.value)} className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[11.8rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Статус</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[8.5rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
            <option value="">Все</option>
            <option value="planning">Планирование</option>
            <option value="active">Активный</option>
            <option value="on_hold">На паузе</option>
            <option value="completed">Завершён</option>
            <option value="archived">В архиве</option>
          </select>
        </div>
      </div>

      <ProjectModal
        isOpen={modalOpen || !!editProject}
        onClose={() => { setModalOpen(false); setEditProject(null); }}
        project={editProject ?? (modalOpen ? null : undefined)}
        workspaceId={currentWorkspace?.id}
      />

      {viewMode === 'list' ? (
        <ul className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-600">
          {allProjects.map((project) => (
            <li key={project.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <Link to={`/projects/${project.id}`} className="min-w-0 flex-1 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 shrink-0 overflow-hidden flex items-center justify-center">
                  {project.logo_url ? (
                    <img src={project.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg text-slate-400">📁</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">{project.name}</h3>
                  {project.description && <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{project.description}</p>}
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{project.status} {project.start_date && `· ${new Date(project.start_date).toLocaleDateString('ru-RU')}`}</p>
                </div>
              </Link>
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditProject(project); }} className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 shrink-0 ml-2" title="Редактировать">✏️</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allProjects.map((project) => (
            <ProjectCard
            key={project.id}
            project={project}
            onEdit={(e) => { e.preventDefault(); e.stopPropagation(); setEditProject(project); }}
          />
        ))}
        </div>
      )}

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
