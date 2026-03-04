import { useQuery } from '@tanstack/react-query';
import { saasApi, type SaasStats } from '../../api/saas';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Константы ─────────────────────────────────────────────────────────────────
const PROVIDER_LABELS: Record<string, string> = {
  yandex_pay: 'Яндекс Пэй',
  yookassa: 'ЮКасса',
  manual: 'Вручную',
};
const PROVIDER_COLORS: Record<string, string> = {
  yandex_pay: '#FC3F1D',  // Яндекс красный
  yookassa: '#6366f1',
  manual: '#64748b',
};
const PIE_COLORS = ['#FC3F1D', '#6366f1', '#22d3ee', '#f59e0b', '#10b981'];

// ── Вспомогательные компоненты ────────────────────────────────────────────────
function StatCard({
  label, value, sub, accent = false,
}: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5 flex flex-col gap-1">
      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-0.5 ${accent ? 'text-red-400' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
      {children}
    </h2>
  );
}

// ── Скелетон загрузки ─────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-slate-700" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-700" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-xl bg-slate-700" />
        <div className="h-72 rounded-xl bg-slate-700" />
      </div>
      <div className="h-72 rounded-xl bg-slate-700" />
    </div>
  );
}

// ── Форматирование ────────────────────────────────────────────────────────────
function fmtRub(val: number | string | undefined) {
  if (val === undefined || val === null) return '—';
  return `${Number(val).toLocaleString('ru-RU')} ₽`;
}

// ── Главный компонент ─────────────────────────────────────────────────────────
export default function SaasDashboardPage() {
  const { data: stats, isLoading, error } = useQuery<SaasStats>({
    queryKey: ['saas-stats'],
    queryFn: () => saasApi.getStats(),
    refetchInterval: 60_000, // авторефреш каждую минуту
  });

  // R3-S4: пробуем revenue endpoint (fallback на stats)
  const { data: revenue } = useQuery<SaasStats>({
    queryKey: ['saas-revenue'],
    queryFn: () => saasApi.getRevenueStats(),
    refetchInterval: 60_000,
  });

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-300">
        Нет доступа или ошибка загрузки. Только суперпользователь.
      </div>
    );
  }

  if (isLoading || !stats) return <DashboardSkeleton />;

  const s = stats;
  const r = revenue ?? stats; // используем revenue если доступен

  // Данные для графиков
  const regData = (s.registrations ?? []).map((x) => ({
    month: x.month ?? '—',
    count: x.count,
  }));

  const revenueByMonth = (r.revenue_by_month ?? []).map((x) => ({
    month: x.month,
    revenue: x.revenue,
    count: x.count,
  }));

  const revenueByProvider = (r.revenue_by_provider ?? []).map((x) => ({
    name: PROVIDER_LABELS[x.provider] ?? x.provider,
    value: x.total,
    count: x.count,
    color: PROVIDER_COLORS[x.provider] ?? '#64748b',
  }));

  const revenueByPlan = (r.revenue_by_plan ?? []).map((x, i) => ({
    name: x.plan,
    revenue: x.total,
    count: x.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const mrr = Number(s.mrr ?? 0);
  const arr = r.arr ? Number(r.arr) : mrr * 12;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Дашборд</h1>
        <span className="text-xs text-slate-500">
          Обновлено: {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* ── KPI-карточки ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Пользователи" value={s.total_users} />
        <StatCard label="Пространства" value={s.active_workspaces} />
        <StatCard
          label="MRR"
          value={fmtRub(mrr)}
          sub="Ежемесячный доход"
          accent
        />
        <StatCard
          label="ARR"
          value={fmtRub(arr)}
          sub="Годовой доход (×12)"
          accent
        />
      </div>

      {/* ── Подписки ─────────────────────────────────────────────────── */}
      {(r.active_subscriptions !== undefined || r.trial_subscriptions !== undefined) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {r.active_subscriptions !== undefined && (
            <StatCard label="Активных подписок" value={r.active_subscriptions} />
          )}
          {r.trial_subscriptions !== undefined && (
            <StatCard label="Триальных" value={r.trial_subscriptions} />
          )}
          {r.churn_count !== undefined && (
            <StatCard label="Отписок (за период)" value={r.churn_count} />
          )}
        </div>
      )}

      {/* ── Revenue по месяцам + Регистрации ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue по месяцам */}
        <section className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-6">
          <SectionHeader>📈 Выручка по месяцам (₽)</SectionHeader>
          {revenueByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FC3F1D" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FC3F1D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v: number) => [fmtRub(v), 'Выручка']}
                />
                <Area
                  type="monotone" dataKey="revenue"
                  stroke="#FC3F1D" fill="url(#revGradient)"
                  strokeWidth={2} dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            /* Fallback: регистрации если нет revenue данных */
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-3">
                Revenue endpoint ещё не готов — показываем регистрации.
                Cursor AI добавит в R3-S4.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={regData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                    formatter={(v: number) => [v, 'Регистраций']}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Breakdown по провайдерам */}
        <section className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-6">
          <SectionHeader>🏦 Выручка по провайдерам</SectionHeader>
          {revenueByProvider.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={revenueByProvider}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {revenueByProvider.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                  formatter={(v: number) => [fmtRub(v), 'Выручка']}
                />
                <Legend
                  formatter={(value) => <span className="text-slate-300 text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center gap-3">
              <p className="text-slate-500 text-sm text-center">
                Данные появятся после первых платежей через Яндекс Пэй / ЮКасса
              </p>
              {/* Превью-заглушка с провайдерами */}
              <div className="flex gap-4 mt-2">
                {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full"
                      style={{ background: PROVIDER_COLORS[key] }} />
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Revenue по тарифам ────────────────────────────────────────── */}
      {revenueByPlan.length > 0 && (
        <section className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-6">
          <SectionHeader>📊 Выручка по тарифам</SectionHeader>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueByPlan} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <YAxis
                tick={{ fill: '#94A3B8', fontSize: 12 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                formatter={(v: number) => [fmtRub(v), 'Выручка']}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {revenueByPlan.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── Регистрации по месяцам (всегда показываем) ───────────────── */}
      <section className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-6">
        <SectionHeader>👥 Регистрации по месяцам</SectionHeader>
        {regData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={regData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v: number) => [v, 'Регистраций']}
              />
              <Bar dataKey="count" name="Регистраций" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-72 flex items-center justify-center text-slate-500">
            Нет данных за период
          </div>
        )}
      </section>
    </div>
  );
}
