import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { workspaceApi } from '../api/workspace';
import { authApi } from '../api/auth';
import { Workspace } from '../types';
import WorkspaceModal from '../components/WorkspaceModal';
import toast from 'react-hot-toast';

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

  const handleDelete = (workspace: Workspace) => {
    if (window.confirm(`Удалить пространство "${workspace.name}"? Все проекты в этом пространстве также будут удалены.`)) {
      deleteMutation.mutate(workspace.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Пространства</h1>
          <p className="text-gray-600 mt-2">
            Пространство — это организация, подразделение или область, которая объединяет проекты и всё что внутри
          </p>
        </div>
        {canCreateWorkspace && (
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            + Новое пространство
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">Загрузка...</div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">Нет пространств</p>
          <p className="text-sm text-gray-400 mb-4">
            {canCreateWorkspace ? 'Создайте пространство для организации ваших проектов' : 'У личного аккаунта одно пространство. Перейдите на бизнес-тариф для создания дополнительных.'}
          </p>
          {canCreateWorkspace && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              + Создать пространство
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((workspace) => (
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
