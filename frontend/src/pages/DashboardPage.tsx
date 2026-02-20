import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';
import { activityApi } from '../api/activity';
import { useAuthStore } from '../store/authStore';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { timetrackingApi } from '../api/timetracking';
import toast from 'react-hot-toast';
import { FinanceChart, BurnRateChart, TeamDistributionChart } from '../components/charts';
import type { ActivityLog, DashboardRecentTask } from '../types';

/** Скелетон загрузки для блока графиков */
function ChartsSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-4 bg-white/10 rounded w-1/3" />
        <div className="flex gap-2 h-48">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex-1 bg-white/10 rounded-t" style={{ height: `${60 + (i % 3) * 20}%` }} />
          ))}
        </div>
        <div className="h-3 bg-white/10 rounded w-full" />
      </div>
    </div>
  );
}

/** Приветствие по времени суток */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/** Формат времени MM:SS */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Виджет «Здоровье компании» — круговой прогресс + статус (SPRINT 1, Cyber-Imperial). */
function WorkspaceHealthWidget({
  progress,
  healthStatus,
}: {
  progress: number;
  healthStatus: string;
}) {
  const isBehind = healthStatus === 'behind';
  const size = 56;
  const strokeWidth = 6;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-imperial-surface/80 px-4 py-2 backdrop-blur-sm">
      <div className="relative flex shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-white/10"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={isBehind ? 'text-amber-500' : 'text-imperial-gold'}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white"
          style={{ fontSize: 11 }}
        >
          {progress}%
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">Здоровье компании</span>
        <span
          className={`inline-flex items-center gap-1 text-sm font-semibold ${isBehind ? 'text-amber-400' : 'text-imperial-gold'
            }`}
        >
          {isBehind ? '🔴 Отставание' : '🔵 В норме'}
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [elapsed, setElapsed] = useState(0);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => analyticsApi.getDashboardOverview(),
    staleTime: 30000,
  });

  const { data: currentWorkspace, isLoading: workspaceCurrentLoading } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });

  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getWorkspaces(),
  });

  const workspaces = workspacesData?.results ?? [];
  const effectiveWorkspace = currentWorkspace ?? (workspaces[0] ?? null);
  const workspaceId = effectiveWorkspace?.id ?? null;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', workspaceId],
    queryFn: () => analyticsApi.getDashboardStats(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => todoApi.getProjects(),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks-dashboard'],
    queryFn: () => todoApi.getTasks({}),
  });

  const { data: recentActivityData } = useQuery({
    queryKey: ['activity-recent'],
    queryFn: () => activityApi.getRecentActivity(15),
  });

  const { data: chartsData, isLoading: chartsLoading } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: () => analyticsApi.getDashboardCharts(),
    staleTime: 60000,
  });

  // Тикаем для активного таймера на дашборде
  useEffect(() => {
    if (!overview?.active_timer) {
      setElapsed(0);
      return;
    }
    setElapsed(overview.active_timer.elapsed_seconds);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [overview?.active_timer?.id, overview?.active_timer?.elapsed_seconds]);

  const projects = projectsData?.results ?? [];
  const recentTasksFromOverview = overview?.recent_tasks ?? [];
  const recentTasks = recentTasksFromOverview.length > 0 ? recentTasksFromOverview : (tasksData?.results ?? []).slice(0, 5);
  const recentProjects = projects.slice(0, 5);
  const activeTasks = stats?.in_progress_tasks ?? stats?.active_tasks ?? 0;
  const completionRate = stats?.completion_rate ?? 0;

  const displayName = user?.first_name || user?.username || 'Пользователь';
  const tasksToday = overview?.tasks_today ?? 0;
  const todayEvents = overview?.today_events_count ?? 0;

  if (overviewLoading && !overview) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Загрузка дашборда...</div>
      </div>
    );
  }

  if (workspaceCurrentLoading && !effectiveWorkspace) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 rounded-2xl bg-slate-200/50 dark:bg-white/5" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-200/50 dark:bg-white/5" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-slate-200/50 dark:bg-white/5" />
      </div>
    );
  }

  if (!workspaceId && !workspaceCurrentLoading) {
    return (
      <div className="space-y-6">
        {/* Сводка дня даже без workspace */}
        {overview && (
          <>
            <section className="rounded-2xl bg-imperial-surface border border-white/5 text-imperial-text p-6 lg:p-8">
              <h1 className="text-2xl font-bold mb-1">
                {getGreeting()}, {displayName}!
              </h1>
              <p className="text-slate-300">
                На сегодня у вас {overview.tasks_today} задач{todayEvents ? ` и ${todayEvents} встреч` : ''}.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-slate-400 uppercase">Мои задачи</p>
                  <p className="text-xl font-bold">{overview.tasks_count}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-slate-400 uppercase">Проекты</p>
                  <p className="text-xl font-bold">{overview.active_projects_count}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-slate-400 uppercase">Бюджет потрачено</p>
                  <p className="text-xl font-bold">{Number(overview.total_budget_spent).toLocaleString('ru-RU')} ₽</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-slate-400 uppercase">Часов сегодня</p>
                  <p className="text-xl font-bold">{overview.hours_today}</p>
                </div>
              </div>
            </section>
            {overview.active_timer && (
              <DashboardActiveTimerCard
                workitemId={overview.active_timer.workitem_id}
                workitemTitle={overview.active_timer.workitem_title}
                elapsedSeconds={elapsed}
              />
            )}
            {recentTasksFromOverview.length > 0 && (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Мои задачи</h2>
                <ul className="space-y-2">
                  {recentTasksFromOverview.map((t: DashboardRecentTask) => (
                    <li key={t.id}>
                      <Link
                        to={`/tasks/${t.id}`}
                        className="block p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <p className="font-medium text-slate-800 dark:text-slate-100">{t.title}</p>
                        <p className="text-xs text-slate-500">{t.status} · {t.project_name || '—'}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link to="/tasks" className="text-primary-600 text-sm font-medium mt-2 inline-block">Все задачи →</Link>
              </section>
            )}
          </>
        )}
        <section className="rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Нет рабочего пространства</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md mx-auto">
            Создайте пространство или перейдите в существующее, чтобы видеть проекты и задачи.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/workspaces"
              className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium"
            >
              Перейти к пространствам
            </Link>
            <Link
              to="/ai/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 bg-imperial-gold/20 text-imperial-gold dark:text-amber-400 rounded-xl hover:bg-imperial-gold/30 font-medium"
            >
              <span aria-hidden>✨</span>
              Маркетплейс ИИ-агентов
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-10">
      {/* Приветствие и сводка дня */}
      {overview && (
        <section className="rounded-2xl bg-imperial-surface border border-white/5 text-imperial-text p-6 lg:p-8">
          <h1 className="text-2xl lg:text-3xl font-bold mb-1">
            {getGreeting()}, {displayName}!
          </h1>
          <p className="text-slate-300 mb-4">
            На сегодня у вас {tasksToday} задач{todayEvents ? ` и ${todayEvents} встреч` : ''}.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase">Мои задачи</p>
              <p className="text-xl font-bold">{overview.tasks_count}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase">Активные проекты</p>
              <p className="text-xl font-bold">{overview.active_projects_count}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase">Потрачено бюджета</p>
              <p className="text-xl font-bold">{Number(overview.total_budget_spent).toLocaleString('ru-RU')} ₽</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase">Часов сегодня</p>
              <p className="text-xl font-bold">{overview.hours_today}</p>
            </div>
          </div>
          {overview.active_timer && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <DashboardActiveTimerCard
                workitemId={overview.active_timer.workitem_id}
                workitemTitle={overview.active_timer.workitem_title}
                elapsedSeconds={elapsed}
              />
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-white/20">
            <Link
              to="/ai/marketplace"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-imperial-gold/20 text-imperial-gold hover:bg-imperial-gold/30 font-medium transition-colors"
            >
              <span aria-hidden>✨</span>
              Маркетплейс ИИ-агентов
            </Link>
          </div>
        </section>
      )}

      {/* Текущее пространство и виджет «Здоровье компании» (SPRINT 1) */}
      {effectiveWorkspace && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Текущее пространство:{' '}
            <Link
              to={`/workspaces/${effectiveWorkspace.id}`}
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
            >
              {effectiveWorkspace.name}
            </Link>
            {' · '}
            <Link to="/workspaces" className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              Все пространства
            </Link>
          </p>
          {(effectiveWorkspace.progress !== undefined || effectiveWorkspace.health_status) && (
            <WorkspaceHealthWidget
              progress={effectiveWorkspace.progress ?? 0}
              healthStatus={effectiveWorkspace.health_status ?? 'on_track'}
            />
          )}
        </div>
      )}
      {/* Hero — стратегический обзор (Cyber-Imperial) */}
      <section className="relative rounded-[2rem] overflow-hidden bg-imperial-surface min-h-[140px] lg:min-h-[160px] flex items-center p-6 lg:p-10 shadow-2xl border border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-imperial-neon/20 to-imperial-bg" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 w-full items-center gap-6">
          <div className="space-y-2 lg:space-y-4">
            <h2 className="text-xl lg:text-2xl font-bold text-imperial-text tracking-tight font-mono">
              Общий монитор <span className="text-imperial-gold">директора</span>
            </h2>
            <p className="text-slate-300 text-sm lg:text-base max-w-lg leading-relaxed">
              Пространства, проекты и задачи в одном экране.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-4 lg:gap-6">
            <div className="bg-white/10 backdrop-blur-md p-4 lg:p-6 rounded-2xl border border-white/10 text-center min-w-[100px] lg:min-w-[120px]">
              <p className="text-[10px] uppercase text-blue-300 font-bold tracking-widest mb-1">Пространств</p>
              <p className="text-2xl lg:text-3xl font-bold text-white">{workspaces.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 lg:p-6 rounded-2xl border border-white/10 text-center min-w-[100px] lg:min-w-[120px]">
              <p className="text-[10px] uppercase text-green-300 font-bold tracking-widest mb-1">Проектов</p>
              <p className="text-2xl lg:text-3xl font-bold text-white">{projects.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* KPI карточки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
        <KpiCard
          title="Всего задач"
          value={stats?.total_tasks ?? 0}
          icon="📋"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          href="/tasks"
          trend={undefined}
        />
        <KpiCard
          title="Активные задачи"
          value={activeTasks}
          icon="⚡"
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          href="/tasks"
          trend="В работе"
        />
        <KpiCard
          title="Завершённые"
          value={stats?.completed_tasks ?? 0}
          icon="✅"
          iconBg="bg-green-50 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
          href="/tasks"
          trend={undefined}
        />
        <KpiCard
          title="Просроченные"
          value={stats?.overdue_tasks ?? 0}
          icon="⚠️"
          iconBg="bg-orange-50 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
          href="/tasks"
          trend={stats?.overdue_tasks ? `${stats.overdue_tasks} треб. внимания` : undefined}
        />
        <KpiCard
          title="Пространства"
          value={(workspaces.length || stats?.active_projects) ?? 0}
          icon="🏢"
          iconBg="bg-purple-50 dark:bg-purple-900/30"
          iconColor="text-purple-600 dark:text-purple-400"
          href="/workspaces"
          trend={undefined}
        />
      </div>

      {/* Графики дашборда (Cyber-Imperial) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {chartsLoading ? (
          <>
            <div className="lg:col-span-2 rounded-2xl bg-imperial-surface border border-white/5 p-6 h-[360px] flex items-center justify-center">
              <ChartsSkeleton className="w-full h-[320px]" />
            </div>
            <div className="rounded-2xl bg-imperial-surface border border-white/5 p-6 h-[320px] flex items-center justify-center">
              <ChartsSkeleton className="w-full h-[280px]" />
            </div>
            <div className="lg:col-span-3 rounded-2xl bg-imperial-surface border border-white/5 p-6 h-[300px] flex items-center justify-center">
              <ChartsSkeleton className="w-full h-[260px]" />
            </div>
          </>
        ) : chartsData ? (
          <>
            <div className="lg:col-span-2 rounded-2xl bg-imperial-surface border border-white/5 p-6 shadow-lg">
              <h3 className="text-lg font-bold text-imperial-gold font-mono mb-4">Финансовый поток</h3>
              <FinanceChart data={chartsData.finance_flow} height={320} />
            </div>
            <div className="rounded-2xl bg-imperial-surface border border-white/5 p-6 shadow-lg">
              <h3 className="text-lg font-bold text-imperial-gold font-mono mb-4">Нагрузка по команде</h3>
              <TeamDistributionChart data={chartsData.team_load} height={320} />
            </div>
            <div className="lg:col-span-2 rounded-2xl bg-imperial-surface border border-white/5 p-6 shadow-lg">
              <h3 className="text-lg font-bold text-imperial-gold font-mono mb-4">Расход по месяцам</h3>
              <BurnRateChart data={chartsData.finance_flow} height={260} />
            </div>
          </>
        ) : null}
      </section>

      {/* Прогресс выполнения (по workspace) */}
      {workspaceId && (stats?.total_tasks ?? 0) > 0 && (
        <section className="bg-white dark:bg-imperial-surface rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-imperial-gold font-mono mb-3">Прогресс выполнения</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round(completionRate))}%` }}
              />
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0">
              {Math.round(completionRate)}% завершено
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {stats?.completed_tasks ?? 0} из {stats?.total_tasks ?? 0} задач
          </p>
        </section>
      )}

      {/* Основной ряд: проекты + быстрые действия */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Проекты / пространства */}
        <div className="lg:col-span-2 bg-white dark:bg-imperial-surface rounded-[1.5rem] lg:rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 lg:p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-lg lg:text-xl font-bold text-slate-800 dark:text-imperial-gold font-mono">Пространства и проекты</h2>
            <Link
              to="/workspaces"
              className="text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline"
            >
              Все пространства →
            </Link>
          </div>
          <div className="p-4 lg:p-6 space-y-2 overflow-y-auto max-h-[320px]">
            {workspaces.length === 0 && projects.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 py-6 text-center">Нет пространств и проектов. Создайте пространство.</p>
            ) : (
              <>
                {workspaces.slice(0, 4).map((ws: { id: number; name: string; projects_count?: number; logo_url?: string | null }) => (
                  <Link
                    key={ws.id}
                    to={`/workspaces/${ws.id}/director`}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-600 overflow-hidden flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-blue-500 transition-all">
                        {ws.logo_url ? (
                          <img src={ws.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl text-slate-500 dark:text-slate-300">🏢</span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{ws.name}</p>
                        <p className="text-xs text-slate-400">Пространство · проектов: {ws.projects_count ?? 0}</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-bold uppercase tracking-tighter">
                      Монитор →
                    </span>
                  </Link>
                ))}
                {recentProjects.map((project: { id: number; name: string; status: string; logo_url?: string | null }) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-600 rounded-xl flex items-center justify-center font-bold text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all text-sm overflow-hidden shrink-0">
                        {project.logo_url ? (
                          <img src={project.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          '📁'
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{project.name}</p>
                        <p className="text-xs text-slate-400">{project.status}</p>
                      </div>
                    </div>
                    <span className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">→</span>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Быстрые действия и последние задачи */}
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] lg:rounded-[2rem] border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 text-sm uppercase tracking-wider">Быстрые действия</h3>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link
                  to="/workspaces"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300">🏢</span>
                  Пространства
                </Link>
              </li>
              <li>
                <Link
                  to="/projects"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300">📁</span>
                  Проекты
                </Link>
              </li>
              <li>
                <Link
                  to="/kanban"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300">📋</span>
                  Этап
                </Link>
              </li>
              <li>
                <Link
                  to="/tasks"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300">✓</span>
                  Задачи
                </Link>
              </li>
            </ul>
          </div>

          {recentTasks.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] lg:rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Мои задачи</h3>
                <Link to="/tasks" className="text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline">Все →</Link>
              </div>
              <div className="p-4 space-y-2">
                {recentTasks.map((task: { id: number; title: string; status: string; priority?: string; project_name?: string | null }) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className="block p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <p className="font-medium text-slate-800 dark:text-slate-100 text-sm line-clamp-1">{task.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{task.status} · {task.project_name || task.priority || '—'}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {recentActivityData?.results && recentActivityData.results.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] lg:rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Последняя активность</h3>
                <Link to="/projects" className="text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline">Проекты →</Link>
              </div>
              <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto">
                {recentActivityData.results.slice(0, 15).map((log: ActivityLog) => (
                  <div key={log.id} className="text-sm text-slate-600 dark:text-slate-400 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{log.user_display}</span>
                    {' '}
                    <span className="text-slate-500 dark:text-slate-400">{log.action_display.toLowerCase()}</span>
                    {log.model_name === 'workitem' ? (
                      <Link to={`/tasks/${log.object_id}`} className="text-blue-600 dark:text-blue-400 hover:underline ml-1">
                        {log.target_display || `#${log.object_id}`}
                      </Link>
                    ) : (
                      <span className="ml-1">{log.target_display || 'проект'}</span>
                    )}
                    <span className="text-xs text-slate-400 ml-2">
                      {new Date(log.timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  iconBg,
  iconColor,
  href,
  trend,
}: {
  title: string;
  value: number;
  icon: string;
  iconBg: string;
  iconColor: string;
  href: string;
  trend?: string;
}) {
  return (
    <Link
      to={href}
      className="bg-white dark:bg-imperial-surface p-6 rounded-2xl lg:rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md hover:border-imperial-gold/30 dark:hover:border-imperial-gold/30 transition-all block"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${iconBg} ${iconColor} text-xl`}>{icon}</div>
        {trend && (
          <span className="text-xs font-bold text-slate-500 dark:text-imperial-muted">{trend}</span>
        )}
      </div>
      <p className="text-slate-400 dark:text-imperial-muted text-[10px] uppercase font-bold tracking-widest">{title}</p>
      <h4 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-imperial-text mt-1 tracking-tight font-mono">{value}</h4>
    </Link>
  );
}

/** Карточка активного таймера на дашборде */
function DashboardActiveTimerCard({
  workitemId,
  workitemTitle,
  elapsedSeconds,
}: {
  workitemId: number;
  workitemTitle: string;
  elapsedSeconds: number;
}) {
  const queryClient = useQueryClient();
  const stopMutation = useMutation({
    mutationFn: () => timetrackingApi.stopTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['active-timer', workitemId] });
      toast.success('Таймер остановлен');
    },
    onError: () => toast.error('Ошибка при остановке таймера'),
  });

  return (
    <div className="flex items-center justify-between gap-4 bg-red-500/20 border border-red-400/40 rounded-xl p-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">Таймер: {workitemTitle || 'Задача'}</p>
          <p className="text-2xl font-mono font-bold text-white tabular-nums">{formatElapsed(elapsedSeconds)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={`/tasks/${workitemId}`}
          className="px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium"
        >
          К задаче
        </Link>
        <button
          type="button"
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
          className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
        >
          Стоп
        </button>
      </div>
    </div>
  );
}
