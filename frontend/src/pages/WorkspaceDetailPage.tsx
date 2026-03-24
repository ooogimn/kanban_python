import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../api/workspace';
import { authApi } from '../api/auth';
import { Project } from '../types';
import ProjectModal from '../components/ProjectModal';
import toast from 'react-hot-toast';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
  viewer: 'Наблюдатель',
};

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = id ? Number(id) : 0;
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'members'>('overview');
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  const { data: workspace, isLoading } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspaceApi.getWorkspace(workspaceId),
    enabled: workspaceId > 0,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['workspace-projects', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceProjects(workspaceId),
    enabled: workspaceId > 0,
  });

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceMembers(workspaceId),
    enabled: workspaceId > 0,
  });
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });
  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getWorkspaces(),
  });
  const workspacesCount = workspacesData?.results?.length ?? 0;
  const planType = profile?.plan_type ?? 'personal';
  const isPersonalWorkspace = profile?.personal_workspace_id != null && workspaceId === profile.personal_workspace_id;
  const canCreateProject = planType === 'business' || !isPersonalWorkspace;
  const canDeleteCurrentWorkspace = Boolean(
    workspace
    && (profile?.is_superuser === true || workspace.user_role === 'owner')
    && !isPersonalWorkspace
    && workspacesCount > 1
  );

  const deleteMutation = useMutation({
    mutationFn: () => workspaceApi.deleteWorkspace(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Пространство удалено');
      navigate('/workspaces');
    },
    onError: () => toast.error('Ошибка при удалении пространства'),
  });

  const handleDelete = () => {
    if (window.confirm('Удалить это пространство? Все проекты в этом пространстве также будут удалены.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  if (!workspace) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">Пространство не найдено</p>
        <Link to="/workspaces" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-2 inline-block">
          ← К пространствам
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-24 h-24 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden flex items-center justify-center shrink-0">
            {workspace.logo_url ? (
              <img src={workspace.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl text-slate-400">📁</span>
            )}
          </div>
          <div>
          <Link
            to="/workspaces"
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 mb-2 inline-block"
          >
            ← Назад к пространствам
          </Link>
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{workspace.name}</h1>
            <Link
              to={`/workspaces/${workspaceId}/director`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 text-sm"
            >
              📊 Страница директора
            </Link>
          </div>
          {workspace.description && (
            <p className="text-slate-600 dark:text-slate-400 mt-2">{workspace.description}</p>
          )}
          {workspace.user_role && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Ваша роль: {ROLE_LABELS[workspace.user_role] || workspace.user_role}
            </p>
          )}
          </div>
        </div>
        {canDeleteCurrentWorkspace && (
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Удалить пространство
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
          >
            Обзор
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'projects'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
          >
            Проекты ({workspace.projects_count ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'members'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
          >
            Участники ({workspace.members_count ?? 0})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 p-6">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Информация о пространстве</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Проектов</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-slate-100">{workspace.projects_count ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Участников</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-slate-100">{workspace.members_count ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-slate-400">Создано</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                    {new Date(workspace.created_at).toLocaleDateString('ru-RU')}
                  </dd>
                </div>
              </dl>
            </div>
            {(workspace.projects_count ?? 0) === 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-6 text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-3">В этом пространстве пока нет проектов</p>
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  + Добавить проект
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Проекты пространства</h2>
              {canCreateProject && (
                <button
                  onClick={() => setProjectModalOpen(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  + Создать проект
                </button>
              )}
            </div>
            {projectsData?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectsData.map((project: Project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 block flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-600 shrink-0 overflow-hidden flex items-center justify-center">
                      {project.logo_url ? (
                        <img src={project.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-400">📁</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">{project.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{project.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400 mb-4">Нет проектов в этом пространстве</p>
                {canCreateProject && (
                  <button
                    onClick={() => setProjectModalOpen(true)}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                  >
                    + Создать проект
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            {membersData?.length ? (
              <ul className="divide-y divide-slate-200 dark:divide-slate-600">
                {membersData.map((member: { id: number; user?: { username?: string; first_name?: string; last_name?: string; email?: string }; role: string }) => (
                  <li key={member.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {member.user?.first_name && member.user?.last_name
                          ? `${member.user.first_name} ${member.user.last_name}`
                          : member.user?.username || 'Пользователь'}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{member.user?.email}</p>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">Нет участников</p>
            )}
          </div>
        )}
      </div>

      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        project={null}
        workspaceId={workspaceId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['workspace-projects', workspaceId] });
          queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
        }}
      />
    </div>
  );
}
