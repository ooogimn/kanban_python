import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workspaceApi } from '../api/workspace';
import { authApi } from '../api/auth';
import { kanbanApi } from '../api/kanban';
import type { Project } from '../types';

export default function WorkspaceDirectorPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = id ? Number(id) : 0;

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

  const { data: boardsData } = useQuery({
    queryKey: ['kanban-boards'],
    queryFn: () => kanbanApi.getBoards(),
  });
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });
  const planType = profile?.plan_type ?? 'personal';
  const isPersonalWorkspace = profile?.personal_workspace_id != null && workspaceId === profile.personal_workspace_id;
  const canCreateProject = planType === 'business' || !isPersonalWorkspace;

  const projects = (projectsData ?? []) as Project[];
  const boards = boardsData?.results ?? [];
  const projectIds = projects.map((p) => p.id);
  const firstBoardForWorkspace = boards.find((b: { project?: number }) =>
    projectIds.includes(b.project ?? 0)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Загрузка монитора пространства...</div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Пространство не найдено</p>
        <Link to="/workspaces" className="text-blue-600 hover:underline mt-2 inline-block">
          ← К пространствам
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-10">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/dashboard" className="hover:text-blue-600">Монитор</Link>
        <span>/</span>
        <Link to="/workspaces" className="hover:text-blue-600">Пространства</Link>
        <span>/</span>
        <Link to={`/workspaces/${workspaceId}`} className="hover:text-blue-600">{workspace.name}</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">Страница директора</span>
      </div>

      {/* Hero — монитор пространства */}
      <section className="relative rounded-[2rem] overflow-hidden bg-slate-900 min-h-[180px] lg:min-h-[220px] flex items-center p-6 lg:p-10 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-slate-900" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 w-full items-center gap-6">
          <div className="flex items-center gap-4 lg:gap-6">
            <div className="w-20 h-20 lg:w-28 lg:h-28 rounded-2xl bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center shrink-0">
              {workspace.logo_url ? (
                <img src={workspace.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl lg:text-5xl text-white/60">📁</span>
              )}
            </div>
            <div className="space-y-2 lg:space-y-4">
              <h1 className="text-2xl lg:text-4xl font-bold text-white tracking-tight">
                Монитор: <span className="text-blue-400">{workspace.name}</span>
              </h1>
              {workspace.description && (
                <p className="text-slate-300 text-sm lg:text-base max-w-lg leading-relaxed line-clamp-2">
                  {workspace.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-4 lg:gap-6">
            <div className="bg-white/10 backdrop-blur-md p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-white/10 text-center min-w-[100px] lg:min-w-[120px]">
              <p className="text-[10px] uppercase text-blue-300 font-bold tracking-widest mb-1">Проектов</p>
              <p className="text-2xl lg:text-3xl font-bold text-white">{workspace.projects_count ?? projects.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-white/10 text-center min-w-[100px] lg:min-w-[120px]">
              <p className="text-[10px] uppercase text-green-300 font-bold tracking-widest mb-1">Участников</p>
              <p className="text-2xl lg:text-3xl font-bold text-white">{workspace.members_count ?? 0}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Быстрые переходы */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to={`/workspaces/${workspaceId}`}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">📋</div>
          <div>
            <p className="font-bold text-slate-800">Обзор пространства</p>
            <p className="text-xs text-slate-500">Участники, настройки</p>
          </div>
        </Link>
        <Link
          to="/projects"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl">📁</div>
          <div>
            <p className="font-bold text-slate-800">Все проекты</p>
            <p className="text-xs text-slate-500">Список проектов</p>
          </div>
        </Link>
        {firstBoardForWorkspace && (
          <Link
            to={`/kanban/${firstBoardForWorkspace.id}`}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl">📋</div>
            <div>
              <p className="font-bold text-slate-800">Этап</p>
              <p className="text-xs text-slate-500">Доска проекта</p>
            </div>
          </Link>
        )}
        <Link
          to="/tasks"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl">✓</div>
          <div>
            <p className="font-bold text-slate-800">Задачи</p>
            <p className="text-xs text-slate-500">Все задачи</p>
          </div>
        </Link>
      </div>

      {/* Проекты пространства с переходами */}
      <div className="bg-white rounded-[1.5rem] lg:rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-lg lg:text-xl font-bold text-slate-800">Проекты пространства</h2>
          {canCreateProject && (
            <Link to={`/workspaces/${workspaceId}`} className="text-blue-600 font-bold text-sm hover:underline">
              + Создать проект (в обзоре)
            </Link>
          )}
        </div>
        <div className="p-4 lg:p-6">
          {projects.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="mb-4">В этом пространстве пока нет проектов</p>
              {canCreateProject && (
                <Link
                  to={`/workspaces/${workspaceId}`}
                  className="inline-flex px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                >
                  Создать проект
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const board = boards.find((b: { project?: number }) => b.project === project.id);
                return (
                  <div
                    key={project.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 lg:p-5 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-600 rounded-xl flex items-center justify-center font-bold text-slate-500 shrink-0 overflow-hidden">
                        {project.logo_url ? (
                          <img src={project.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          '📁'
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{project.name}</p>
                        <p className="text-xs text-slate-500">{project.status}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/projects/${project.id}`}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        Проект
                      </Link>
                      {board && (
                        <Link
to={`/kanban/${board.id}`}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                      >
                        Этап
                        </Link>
                      )}
                      <Link
                        to={`/projects/${project.id}?tab=wiki`}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      >
                        Записки
                      </Link>
                      <Link
                        to={`/projects/${project.id}?tab=list`}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
                      >
                        Задачи
                      </Link>
                      <Link
                        to={`/gantt/${project.id}`}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-100 text-violet-700 hover:bg-violet-200"
                      >
                        Гант
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
