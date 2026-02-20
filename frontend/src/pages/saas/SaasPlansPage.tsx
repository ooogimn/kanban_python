import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saasApi, type SaasPlan, type SaasPlanCreateUpdate } from '../../api/saas';
import toast from 'react-hot-toast';

function PlanModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: SaasPlan | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(plan?.price ?? '0');
  const [currency, setCurrency] = useState(plan?.currency ?? 'RUB');
  const [limitsStr, setLimitsStr] = useState(
    plan ? JSON.stringify(plan.limits, null, 2) : JSON.stringify({ max_system_contacts: 10, max_ai_agents: 1, features: { hr: true, payroll: false, ai_analyst: false } }, null, 2)
  );
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(plan?.is_default ?? false);

  const createMutation = useMutation({
    mutationFn: (data: SaasPlanCreateUpdate) => saasApi.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-plans'] });
      toast.success('План создан');
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SaasPlanCreateUpdate>) => saasApi.updatePlan(plan!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-plans'] });
      toast.success('План обновлён');
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let limits: Record<string, unknown>;
    try {
      limits = JSON.parse(limitsStr);
    } catch {
      toast.error('Невалидный JSON в лимитах');
      return;
    }
    const payload = {
      name: name.trim(),
      price: Number(price) || 0,
      currency,
      limits,
      is_active: isActive,
      is_default: isDefault,
    };
    if (plan) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4">{plan ? 'Редактировать план' : 'Создать план'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Цена</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Валюта</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Лимиты (JSON)</label>
            <textarea
              value={limitsStr}
              onChange={(e) => setLimitsStr(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white font-mono text-sm"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
              Активен
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
              По умолчанию
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700">
              Отмена
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50" disabled={createMutation.isPending || updateMutation.isPending}>
              {plan ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SaasPlansPage() {
  const [modalPlan, setModalPlan] = useState<SaasPlan | null | 'create'>(null);
  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ['saas-plans'],
    queryFn: () => saasApi.getPlans(),
  });

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-300">
        Ошибка загрузки планов.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Планы</h1>
        <button
          type="button"
          onClick={() => setModalPlan('create')}
          className="rounded-lg bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-500"
        >
          + Создать
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-8 text-center text-slate-400">Загрузка…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-600 bg-slate-800/80">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Название</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Цена</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">По умолчанию</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-slate-600/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{p.price} {p.currency}</td>
                  <td className="px-4 py-3 text-slate-400">{p.is_default ? 'Да' : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setModalPlan(p)}
                      className="text-sm text-red-300 hover:text-red-200"
                    >
                      Редактировать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalPlan !== null && (
        <PlanModal
          key={modalPlan === 'create' ? 'create' : (modalPlan as SaasPlan).id}
          plan={modalPlan === 'create' ? null : modalPlan}
          onClose={() => setModalPlan(null)}
          onSuccess={() => setModalPlan(null)}
        />
      )}
    </div>
  );
}
