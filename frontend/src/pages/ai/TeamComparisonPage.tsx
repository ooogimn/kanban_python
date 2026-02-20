import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { workspaceApi } from '../../api/workspace';
import { aiApi } from '../../api/ai';

export default function TeamComparisonPage() {
  const { data: workspaceData } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const workspaceId = workspaceData?.id ?? 0;

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-team-comparison', workspaceId],
    queryFn: () => aiApi.getTeamComparison(workspaceId),
    enabled: workspaceId > 0,
  });

  const comparison = data ?? { humans: [], ai: [] };
  const humans = comparison.humans ?? [];
  const ai = comparison.ai ?? [];

  const totalHours = humans.reduce((s, h) => s + (h.total_hours ?? 0), 0);
  const totalPayroll = humans.reduce((s, h) => s + parseFloat(h.payroll_total || '0'), 0);
  const totalTasks = humans.reduce((s, h) => s + (h.tasks_count ?? 0), 0);
  const totalAiMessages = ai.reduce((s, a) => s + (a.message_count ?? 0), 0);
  const totalAiCost = ai.reduce((s, a) => s + parseFloat(a.monthly_cost || '0'), 0);

  if (!workspaceId) {
    return (
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
        Выберите рабочее пространство, чтобы увидеть сравнение команды.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center text-imperial-muted">
        Загрузка данных сравнения…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-imperial-surface/60 p-8 text-center text-red-400">
        Не удалось загрузить данные. Попробуйте позже.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">
          Сравнение: люди vs ИИ-сотрудники
        </h1>
        <Link
          to="/contacts"
          className="px-4 py-2 rounded-xl bg-imperial-gold/20 text-imperial-gold font-medium hover:bg-imperial-gold/30 border border-imperial-gold/40 transition-colors"
        >
          Контакты и ИИ-сотрудники
        </Link>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-imperial-surface/80 p-4">
          <div className="text-imperial-muted text-sm">Часы (люди)</div>
          <div className="text-xl font-bold text-white">{totalHours.toLocaleString('ru-RU')} ч</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-imperial-surface/80 p-4">
          <div className="text-imperial-muted text-sm">Выплаты (люди)</div>
          <div className="text-xl font-bold text-white">{totalPayroll.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-imperial-surface/80 p-4">
          <div className="text-imperial-muted text-sm">Сообщений (ИИ)</div>
          <div className="text-xl font-bold text-white">{totalAiMessages.toLocaleString('ru-RU')}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-imperial-surface/80 p-4">
          <div className="text-imperial-muted text-sm">Затраты ИИ (мес)</div>
          <div className="text-xl font-bold text-white">{totalAiCost.toLocaleString('ru-RU')} ₽</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Люди */}
        <div className="rounded-xl border border-white/10 bg-imperial-surface/80 overflow-hidden">
          <h2 className="p-4 border-b border-white/10 text-lg font-semibold text-white bg-white/5">
            👥 Команда (люди)
          </h2>
          {humans.length === 0 ? (
            <p className="p-4 text-imperial-muted text-sm">Нет данных по сотрудникам в этом пространстве.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-imperial-muted">
                    <th className="p-3 font-medium">Имя</th>
                    <th className="p-3 font-medium">Часы</th>
                    <th className="p-3 font-medium">Выплаты</th>
                    <th className="p-3 font-medium">Задачи</th>
                  </tr>
                </thead>
                <tbody>
                  {humans.map((h) => (
                    <tr key={h.contact_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3 font-medium text-white">{h.name}</td>
                      <td className="p-3 text-imperial-muted">{h.total_hours?.toLocaleString('ru-RU') ?? '0'} ч</td>
                      <td className="p-3 text-imperial-muted">{parseFloat(h.payroll_total || '0').toLocaleString('ru-RU')} ₽</td>
                      <td className="p-3 text-imperial-muted">{h.tasks_count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {humans.length > 0 && (
            <div className="p-3 border-t border-white/10 text-imperial-muted text-xs">
              Всего задач по команде: {totalTasks}
            </div>
          )}
        </div>

        {/* ИИ */}
        <div className="rounded-xl border border-white/10 bg-imperial-surface/80 overflow-hidden">
          <h2 className="p-4 border-b border-white/10 text-lg font-semibold text-white bg-white/5">
            ✨ ИИ-сотрудники
          </h2>
          {ai.length === 0 ? (
            <p className="p-4 text-imperial-muted text-sm">Нет нанятых ИИ-агентов. <Link to="/ai/marketplace" className="text-imperial-gold hover:underline">Маркетплейс</Link></p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-imperial-muted">
                    <th className="p-3 font-medium">Агент</th>
                    <th className="p-3 font-medium">Роль</th>
                    <th className="p-3 font-medium">Сообщений</th>
                    <th className="p-3 font-medium">Затраты (₽/мес)</th>
                  </tr>
                </thead>
                <tbody>
                  {ai.map((a) => (
                    <tr key={a.workspace_agent_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3 font-medium text-white">{a.name}</td>
                      <td className="p-3 text-imperial-muted capitalize">{a.role}</td>
                      <td className="p-3 text-imperial-muted">{a.message_count?.toLocaleString('ru-RU') ?? 0}</td>
                      <td className="p-3 text-imperial-muted">{parseFloat(a.monthly_cost || '0').toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ai.length > 0 && (
            <div className="p-3 border-t border-white/10 text-imperial-muted text-xs">
              Сумма затрат на ИИ в месяц: {totalAiCost.toLocaleString('ru-RU')} ₽
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-imperial-muted">
        Сравнение продуктивности и затрат по текущему рабочему пространству. По людям учитываются часы (TimeLog), выплаты (транзакции) и задачи; по ИИ — сообщения в чате и ежемесячная стоимость агентов.
      </p>
    </div>
  );
}
