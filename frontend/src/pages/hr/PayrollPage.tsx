import { useState, useMemo, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workspaceApi } from '../../api/workspace';
import { hrApi, type PayrollContactItem, type PayPayrollPayload } from '../../api/hr';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

type PeriodPreset = 'current_month' | 'last_month' | 'custom';

function getPeriodBounds(preset: PeriodPreset, customStart?: string, customEnd?: string): { start: string; end: string } {
  const today = new Date();
  if (preset === 'current_month') {
    return {
      start: format(startOfMonth(today), 'yyyy-MM-dd'),
      end: format(endOfMonth(today), 'yyyy-MM-dd'),
    };
  }
  if (preset === 'last_month') {
    const last = subMonths(today, 1);
    return {
      start: format(startOfMonth(last), 'yyyy-MM-dd'),
      end: format(endOfMonth(last), 'yyyy-MM-dd'),
    };
  }
  return {
    start: customStart || format(startOfMonth(today), 'yyyy-MM-dd'),
    end: customEnd || format(endOfMonth(today), 'yyyy-MM-dd'),
  };
}

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('current_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [projectFilterId, setProjectFilterId] = useState<number | ''>('');
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);
  const [confirmPay, setConfirmPay] = useState<{
    contactName: string;
    projectName: string;
    totalHours: number;
    totalAmount: string;
    start: string;
    end: string;
    payload: PayPayrollPayload;
  } | null>(null);

  const { data: workspaceData } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const workspaceId = workspaceData?.id ?? 0;

  const { start: startDate, end: endDate } = getPeriodBounds(periodPreset, customStart, customEnd);

  const { data: report = [], isLoading, isError, error } = useQuery({
    queryKey: ['payroll', workspaceId, startDate, endDate],
    queryFn: () => hrApi.getPayrollStats({ workspace_id: workspaceId, start_date: startDate, end_date: endDate }),
    enabled: workspaceId > 0,
  });

  const isFeatureLocked = isError && (error as { response?: { data?: { code?: string } } })?.response?.data?.code === 'FEATURE_LOCKED';

  const filteredReport = useMemo(() => {
    if (projectFilterId === '') return report;
    return report.map((item) => ({
      ...item,
      projects: item.projects.filter((p) => p.project.id === projectFilterId),
    })).filter((item) => item.projects.length > 0);
  }, [report, projectFilterId]);

  const allProjectIds = useMemo(() => {
    const ids = new Set<number>();
    report.forEach((item) => item.projects.forEach((p) => ids.add(p.project.id)));
    return Array.from(ids);
  }, [report]);

  const handlePayClick = (item: PayrollContactItem, proj: (typeof item.projects)[0]) => {
    setConfirmPay({
      contactName: [item.contact.first_name, item.contact.last_name].filter(Boolean).join(' ') || 'Сотрудник',
      projectName: proj.project.name,
      totalHours: proj.total_hours,
      totalAmount: proj.total_amount,
      start: startDate,
      end: endDate,
      payload: {
        workspace_id: workspaceId,
        project_id: proj.project.id,
        contact_id: item.contact.id,
        start_date: startDate,
        end_date: endDate,
        log_ids: proj.log_ids,
      },
    });
  };

  const handleConfirmPay = async () => {
    if (!confirmPay) return;
    try {
      await hrApi.payPayroll(confirmPay.payload);
      toast.success('Выплата выполнена');
      queryClient.invalidateQueries({ queryKey: ['payroll', workspaceId, startDate, endDate] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      setConfirmPay(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Ошибка при выплате');
    }
  };

  if (!workspaceId) {
    return (
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
        Выберите рабочее пространство, чтобы открыть ведомость.
      </div>
    );
  }

  if (isFeatureLocked) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
        <p className="text-amber-200 font-medium mb-2">Модуль «Зарплата» недоступен на вашем тарифе</p>
        <p className="text-imperial-muted text-sm">Улучшите план для доступа к ведомости и выплатам.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Ведомость</h1>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-imperial-surface/60 p-4">
        <span className="text-imperial-muted text-sm font-medium">Период:</span>
        <div className="flex flex-wrap items-center gap-2">
          {(['current_month', 'last_month', 'custom'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodPreset(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${periodPreset === p
                  ? 'bg-imperial-gold text-imperial-bg'
                  : 'bg-white/5 text-imperial-muted hover:bg-white/10 hover:text-white'
                }`}
            >
              {p === 'current_month' ? 'Текущий месяц' : p === 'last_month' ? 'Прошлый месяц' : 'Свой период'}
            </button>
          ))}
        </div>
        {periodPreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
            <span className="text-imperial-muted">—</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
          </div>
        )}
        {allProjectIds.length > 0 && (
          <>
            <span className="text-imperial-muted text-sm font-medium ml-2">Проект:</span>
            <select
              value={projectFilterId === '' ? '' : projectFilterId}
              onChange={(e) => setProjectFilterId(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white min-w-[180px]"
            >
              <option value="">Все проекты</option>
              {Array.from(
                new Map(
                  report.flatMap((r) => r.projects.map((p) => [p.project.id, p.project]))
                ).values()
              ).map((proj) => (
                <option key={proj.id} value={proj.id}>{proj.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px] text-imperial-muted">Загрузка…</div>
      ) : filteredReport.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
          Нет неоплаченных часов за выбранный период.
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-imperial-surface/60 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-imperial-muted text-sm">
                <th className="p-3 w-10" />
                <th className="p-3">Сотрудник</th>
                <th className="p-3 text-right">Сумма по периоду</th>
              </tr>
            </thead>
            <tbody>
              {filteredReport.map((item) => {
                const totalAmount = item.projects.reduce((s, p) => s + parseFloat(p.total_amount), 0);
                const isExpanded = expandedContactId === item.contact.id;
                const name = [item.contact.first_name, item.contact.last_name].filter(Boolean).join(' ') || '—';
                return (
                  <Fragment key={item.contact.id}>
                    <tr
                      key={item.contact.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setExpandedContactId(isExpanded ? null : item.contact.id)}
                          className="text-imperial-muted hover:text-white"
                          aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {item.contact.avatar_url ? (
                            <img src={item.contact.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-imperial-gold/20 flex items-center justify-center text-imperial-gold font-bold">
                              {name[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <span className="font-medium text-white">{name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium text-imperial-gold">
                        {totalAmount.toFixed(2)} ₽
                      </td>
                    </tr>
                    {isExpanded &&
                      item.projects.map((proj) => (
                        <tr key={`${item.contact.id}-${proj.project.id}`} className="border-b border-white/5 bg-white/5">
                          <td className="p-3 w-10" />
                          <td className="p-3 pl-12 text-imperial-muted">{proj.project.name}</td>
                          <td className="p-3 text-right">
                            <span className="text-imperial-muted mr-4">
                              {proj.total_hours.toFixed(1)} ч
                            </span>
                            <span className="mr-4">{proj.total_amount} ₽</span>
                            <button
                              type="button"
                              onClick={() => handlePayClick(item, proj)}
                              className="rounded-lg px-3 py-1.5 bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 transition-colors text-sm"
                            >
                              Выплатить
                            </button>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-xl border border-white/10 bg-imperial-surface p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Подтверждение выплаты</h3>
            <p className="text-imperial-muted text-sm mb-4">
              Выплатить {confirmPay.totalAmount} ₽ за {confirmPay.totalHours.toFixed(1)} ч сотруднику{' '}
              <strong className="text-white">{confirmPay.contactName}</strong> по проекту{' '}
              <strong className="text-white">{confirmPay.projectName}</strong> за период{' '}
              {confirmPay.start}–{confirmPay.end}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmPay(null)}
                className="rounded-lg px-4 py-2 bg-white/10 text-imperial-muted hover:bg-white/15 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmPay}
                className="rounded-lg px-4 py-2 bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 transition-colors"
              >
                Выплатить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
