import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X, Pencil, Trash2 } from 'lucide-react';
import { hrApi } from '../../api/hr';
import type { PayrollRun, PayrollItem } from '../../types/hr';

interface PayrollRunDetailModalProps {
  runId: number | null;
  onClose: () => void;
  workspaceId: number;
  /** Только Director может корректировать/удалять строки (только в DRAFT). */
  canEdit: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  PAID: 'Выплачено',
};

export function PayrollRunDetailModal({ runId, onClose, workspaceId, canEdit }: PayrollRunDetailModalProps) {
  const queryClient = useQueryClient();
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editNetAmount, setEditNetAmount] = useState('');

  const { data: run, isLoading } = useQuery({
    queryKey: ['hr-payroll-run', runId],
    queryFn: () => hrApi.getPayrollRun(runId!),
    enabled: !!runId,
  });

  const updateItemMutation = useMutation({
    mutationFn: (params: { itemId: number; net_amount: string }) =>
      hrApi.updatePayrollItem(params.itemId, { net_amount: params.net_amount }),
    onSuccess: (_, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: ['hr-payroll-run', runId] });
      queryClient.invalidateQueries({ queryKey: ['hr-payroll-runs', workspaceId] });
      setEditingItemId(null);
      toast.success('Сумма обновлена');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка при обновлении');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => hrApi.deletePayrollItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-payroll-run', runId] });
      queryClient.invalidateQueries({ queryKey: ['hr-payroll-runs', workspaceId] });
      toast.success('Строка удалена');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка при удалении');
    },
  });

  const handleStartEdit = (item: PayrollItem) => {
    setEditingItemId(item.id);
    setEditNetAmount(item.net_amount);
  };

  const handleSaveEdit = () => {
    if (editingItemId === null || !editNetAmount) return;
    const amount = parseFloat(editNetAmount);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Укажите корректную сумму');
      return;
    }
    updateItemMutation.mutate({ itemId: editingItemId, net_amount: editNetAmount });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditNetAmount('');
  };

  const handleDelete = (itemId: number) => {
    if (!window.confirm('Удалить эту строку из ведомости?')) return;
    deleteItemMutation.mutate(itemId);
  };

  const allowEditDelete = canEdit && run?.status === 'DRAFT';

  if (!runId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl border border-white/10 bg-imperial-surface p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Зарплатная ведомость</h3>
            {run && (
              <p className="text-imperial-muted text-sm mt-1">
                {run.period_start} — {run.period_end} • {run.total_amount} {run.currency} •{' '}
                <span className={run.status === 'DRAFT' ? 'text-amber-400' : 'text-emerald-400'}>
                  {STATUS_LABEL[run.status] ?? run.status}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-imperial-muted hover:bg-white/10 hover:text-white"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-imperial-muted py-8 text-center">Загрузка…</div>
        ) : !run ? (
          <div className="text-imperial-muted py-8 text-center">Ведомость не найдена</div>
        ) : (
          <div className="overflow-auto flex-1 -mx-2 px-2">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-imperial-muted">
                  <th className="p-3">ФИО</th>
                  <th className="p-3">Должность</th>
                  <th className="p-3">Ставка</th>
                  <th className="p-3 text-right">Сумма</th>
                  {allowEditDelete && <th className="p-3 text-right w-24">Действия</th>}
                </tr>
              </thead>
              <tbody>
                {(run.items ?? []).map((item) => (
                  <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-white font-medium">{item.employee_display}</td>
                    <td className="p-3 text-imperial-muted">{item.job_title ?? '—'}</td>
                    <td className="p-3 text-imperial-muted">{item.salary_rate ?? '—'}</td>
                    <td className="p-3 text-right">
                      {editingItemId === item.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            value={editNetAmount}
                            onChange={(e) => setEditNetAmount(e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-28 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white text-right"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={updateItemMutation.isPending}
                            className="px-2 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-2 py-1 rounded bg-white/10 text-imperial-muted text-xs hover:bg-white/20"
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-imperial-gold">
                          {item.net_amount} {run.currency}
                        </span>
                      )}
                    </td>
                    {allowEditDelete && (
                      <td className="p-3 text-right">
                        {editingItemId === item.id ? null : (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              className="p-1.5 rounded text-imperial-muted hover:bg-white/10 hover:text-amber-400"
                              title="Корректировать"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              disabled={deleteItemMutation.isPending}
                              className="p-1.5 rounded text-imperial-muted hover:bg-white/10 hover:text-red-400 disabled:opacity-50"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {(!run.items || run.items.length === 0) && (
              <div className="py-8 text-center text-imperial-muted">Нет строк в ведомости</div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 mt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 text-imperial-muted hover:bg-white/15"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
