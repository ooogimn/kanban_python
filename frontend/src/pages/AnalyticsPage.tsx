import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';
import { workspaceApi } from '../api/workspace';
import { todoApi } from '../api/todo';

export default function AnalyticsPage() {
  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const workspaceId = currentWorkspace?.id ?? null;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', workspaceId],
    queryFn: () => analyticsApi.getDashboardStats(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => todoApi.getProjects(),
  });
  const projects = projectsData?.results ?? [];

  const [exportingTasks, setExportingTasks] = useState(false);
  const [exportingProjects, setExportingProjects] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportTasks = async () => {
    if (!workspaceId) return;
    setExportError(null);
    setExportingTasks(true);
    try {
      await analyticsApi.exportTasksCsv({ workspace_id: workspaceId });
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Ошибка экспорта задач');
    } finally {
      setExportingTasks(false);
    }
  };

  const handleExportProjects = async () => {
    if (!workspaceId) return;
    setExportError(null);
    setExportingProjects(true);
    try {
      await analyticsApi.exportProjectsCsv(workspaceId);
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Ошибка экспорта проектов');
    } finally {
      setExportingProjects(false);
    }
  };

  if (statsLoading && workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500 dark:text-slate-400">Загрузка аналитики...</p>
      </div>
    );
  }

  if (!workspaceId && !statsLoading) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Нет рабочего пространства</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md mx-auto">
            Выберите пространство, чтобы видеть аналитику и экспортировать отчёты.
          </p>
          <Link
            to="/workspaces"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium"
          >
            Перейти к пространствам
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-100">Аналитика и отчёты</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {currentWorkspace && (
            <>Пространство: <Link to={`/workspaces/${currentWorkspace.id}`} className="text-primary-600 dark:text-primary-400 font-medium">{currentWorkspace.name}</Link></>
          )}
        </p>
      </div>

      {/* Сводка */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Сводка по пространству</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Всего задач" value={stats?.total_tasks ?? 0} />
          <StatCard title="В работе" value={stats?.in_progress_tasks ?? 0} />
          <StatCard title="Завершено" value={stats?.completed_tasks ?? 0} />
          <StatCard title="Просрочено" value={stats?.overdue_tasks ?? 0} />
          <StatCard title="Активных проектов" value={stats?.active_projects ?? 0} />
          <StatCard title="% выполнения" value={`${Math.round(stats?.completion_rate ?? 0)}%`} />
        </div>
      </section>

      {/* Экспорт отчётов */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Экспорт отчётов</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Скачайте задачи или проекты текущего пространства в формате CSV для анализа в Excel или Google Таблицах.
        </p>
        {exportError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{exportError}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportTasks}
            disabled={exportingTasks || !workspaceId}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {exportingTasks ? 'Скачивание...' : 'Экспорт задач (CSV)'}
          </button>
          <button
            type="button"
            onClick={handleExportProjects}
            disabled={exportingProjects || !workspaceId}
            className="px-5 py-2.5 bg-slate-600 dark:bg-slate-500 text-white rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {exportingProjects ? 'Скачивание...' : 'Экспорт проектов (CSV)'}
          </button>
        </div>
      </section>

      {/* Проекты с быстрым экспортом по проекту */}
      {projects.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Экспорт задач по проекту</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Скачать только задачи выбранного проекта.
          </p>
          <div className="flex flex-wrap gap-2">
            {projects.slice(0, 20).map((p: { id: number; name: string }) => (
              <button
                key={p.id}
                type="button"
                onClick={async () => {
                  setExportError(null);
                  try {
                    await analyticsApi.exportTasksCsv({ project_id: p.id });
                  } catch (e: unknown) {
                    setExportError(e instanceof Error ? e.message : 'Ошибка экспорта');
                  }
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Метрики дашборда кэшируются на 5 минут. Для детальной аналитики по проекту откройте страницу проекта.
      </p>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-100 dark:border-slate-600">
      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
      <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{value}</p>
    </div>
  );
}
