import { useQuery } from '@tanstack/react-query';
import { saasApi, type SaasStats } from '../../api/saas';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export default function SaasDashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['saas-stats'],
    queryFn: () => saasApi.getStats(),
  });

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-300">
        Нет доступа или ошибка загрузки. Только суперпользователь.
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-slate-700" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-700" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-slate-700" />
      </div>
    );
  }

  const s = stats as SaasStats;
  const chartData = (s.registrations || []).map((r) => ({
    month: r.month || '—',
    count: r.count,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Дашборд</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-6">
          <p className="text-sm text-slate-400 uppercase tracking-wider">Пользователи</p>
          <p className="text-3xl font-bold text-white mt-1">{s.total_users}</p>
        </div>
        <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-6">
          <p className="text-sm text-slate-400 uppercase tracking-wider">Пространства</p>
          <p className="text-3xl font-bold text-white mt-1">{s.active_workspaces}</p>
        </div>
        <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-6">
          <p className="text-sm text-slate-400 uppercase tracking-wider">MRR (₽)</p>
          <p className="text-3xl font-bold text-red-300 mt-1">
            {Number(s.mrr).toLocaleString('ru-RU')}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-600 bg-slate-800/80 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Регистрации по месяцам</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value: number) => [value, 'Регистраций']}
              />
              <Bar dataKey="count" name="Регистраций" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-80 flex items-center justify-center text-slate-500">
            Нет данных за период
          </div>
        )}
      </section>
    </div>
  );
}
