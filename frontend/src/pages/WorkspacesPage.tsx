import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Maximize2, Minimize2, LayoutGrid, List } from 'lucide-react';
import { workspaceApi } from '../api/workspace';
import { authApi } from '../api/auth';
import { Workspace } from '../types';
import WorkspaceModal from '../components/WorkspaceModal';
import toast from 'react-hot-toast';
import { downloadCsv } from '../utils/exportCsv';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
  viewer: 'Наблюдатель',
};

export default function WorkspacesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [exportLoading, setExportLoading] = useState<'jpg' | 'pdf' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: workspacesData, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getWorkspaces(),
  });
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });
  const planType = profile?.plan_type ?? 'personal';
  const canCreateWorkspace = planType === 'business' || profile?.is_superuser === true;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => workspaceApi.deleteWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Пространство удалено');
    },
    onError: () => toast.error('Ошибка при удалении пространства'),
  });

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const workspaces = workspacesData?.results ?? [];
  const filteredWorkspaces = searchQuery.trim()
    ? workspaces.filter((w) => w.name?.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : workspaces;

  const exportOptions = { pixelRatio: 2, cacheBust: true };
  const handleExportJpg = useCallback(() => {
    if (!pageRef.current) return;
    setExportLoading('jpg');
    toJpeg(pageRef.current, { ...exportOptions, quality: 0.95 })
      .then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `workspaces-${Date.now()}.jpg`;
        a.click();
        toast.success('Сохранено в JPG');
      })
      .catch(() => toast.error('Не удалось сохранить JPG'))
      .finally(() => setExportLoading(null));
  }, []);
  const handleExportPdf = useCallback(() => {
    if (!pageRef.current) return;
    setExportLoading('pdf');
    toPng(pageRef.current, exportOptions)
      .then((dataUrl) => {
        const img = new Image();
        img.onload = () => {
          const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width, img.height] });
          pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
          pdf.save(`workspaces-${Date.now()}.pdf`);
          toast.success('Сохранено в PDF');
        };
        img.src = dataUrl;
      })
      .catch(() => toast.error('Не удалось сохранить PDF'))
      .finally(() => setExportLoading(null));
  }, []);
  const handleExportExcel = useCallback(() => {
    const rows: (string | number)[][] = [['Название', 'Описание', 'Проектов', 'Участников']];
    filteredWorkspaces.forEach((w) => rows.push([w.name ?? '', w.description ?? '', w.projects_count ?? 0, w.members_count ?? 0]));
    downloadCsv(`workspaces-${Date.now()}.csv`, rows);
    toast.success('Сохранено в CSV');
  }, [filteredWorkspaces]);
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

  const handleDelete = (workspace: Workspace) => {
    if (window.confirm(`Удалить пространство "${workspace.name}"? Все проекты в этом пространстве также будут удалены.`)) {
      deleteMutation.mutate(workspace.id);
    }
  };

  return (
    <div ref={pageRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Пространства</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Пространство — это организация, подразделение или область, которая объединяет проекты и всё что внутри
          </p>
        </div>
        <div className="flex flex-nowrap items-center gap-1.5">
          {canCreateWorkspace && (
            <>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                title="Новое пространство"
                className="px-2 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium text-xs"
              >
                +
              </button>
              <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
            </>
          )}
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
          <input type="search" placeholder="Название пространства..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[11.8rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Загрузка...</div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 mb-4">{searchQuery.trim() ? 'Ничего не найдено' : 'Нет пространств'}</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
            {canCreateWorkspace && !searchQuery.trim() ? 'Создайте пространство для организации ваших проектов' : !searchQuery.trim() ? 'У личного аккаунта одно пространство. Перейдите на бизнес-тариф для создания дополнительных.' : 'Измените критерии поиска.'}
          </p>
          {canCreateWorkspace && !searchQuery.trim() && (
            <button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">+ Создать пространство</button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <ul className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-600">
          {filteredWorkspaces.map((workspace) => (
            <li key={workspace.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">{workspace.name}</h3>
                {workspace.description && <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{workspace.description}</p>}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Проектов: {workspace.projects_count ?? 0} · Участников: {workspace.members_count ?? 0}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button type="button" onClick={() => { setSelectedWorkspace(workspace); setModalOpen(true); }} className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" title="Редактировать">✏️</button>
                {workspace.user_role === 'owner' && <button type="button" onClick={() => handleDelete(workspace)} className="p-1.5 text-slate-500 hover:text-red-600" title="Удалить">🗑️</button>}
                <Link to={`/workspaces/${workspace.id}`} className="px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm">Открыть</Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              onEdit={() => {
                setSelectedWorkspace(workspace);
                setModalOpen(true);
              }}
              onDelete={() => handleDelete(workspace)}
            />
          ))}
        </div>
      )}

      <WorkspaceModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedWorkspace(null);
        }}
        workspace={selectedWorkspace}
      />
    </div>
  );
}

function WorkspaceCard({
  workspace,
  onEdit,
  onDelete,
}: {
  workspace: Workspace;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg dark:hover:border-slate-600 transition-shadow">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden flex items-center justify-center shrink-0">
          {workspace.logo_url ? (
            <img src={workspace.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl text-slate-400">📁</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">{workspace.name}</h3>
          {workspace.user_role && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {ROLE_LABELS[workspace.user_role] || workspace.user_role}
            </span>
          )}
          <div className="flex gap-1 mt-1">
          <button
            onClick={onEdit}
            className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            title="Редактировать"
          >
            ✏️
          </button>
          {workspace.user_role === 'owner' && (
            <button
              onClick={onDelete}
              className="p-1 text-slate-500 hover:text-red-600 dark:text-slate-400"
              title="Удалить"
            >
              🗑️
            </button>
          )}
          </div>
        </div>
      </div>

      {workspace.description && (
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-2">{workspace.description}</p>
      )}

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-4">
        <span>Проектов: {workspace.projects_count ?? 0}</span>
        <span>Участников: {workspace.members_count ?? 0}</span>
      </div>

      <div className="flex gap-2">
        <Link
          to={`/workspaces/${workspace.id}`}
          className="flex-1 text-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
        >
          Открыть
        </Link>
        <Link
          to={`/workspaces/${workspace.id}/director`}
          className="flex-1 text-center px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 text-sm"
        >
          📊 Монитор
        </Link>
      </div>
    </div>
  );
}
