import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saasApi, type SaasUserListItem, type SaasUserEvent } from '../../api/saas';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const EVENT_LABELS: Record<string, string> = {
  login: 'Вход в систему',
  ads_off: 'Реклама отключена',
  ads_on: 'Реклама включена',
  business_off: 'Бизнес-тариф выключен',
  business_on: 'Бизнес-тариф включён',
  payment: 'Платёж',
};

export default function SaasUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const userId = id ? parseInt(id, 10) : NaN;
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['saas-user', userId],
    queryFn: () => saasApi.getUser(userId),
    enabled: Number.isFinite(userId),
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['saas-user-events', userId],
    queryFn: () => saasApi.getUserEvents(userId),
    enabled: Number.isFinite(userId),
  });

  const manageAccessMutation = useMutation({
    mutationFn: (forceBusiness: boolean) => saasApi.manageAccess(userId, forceBusiness),
    onSuccess: (_, forceBusiness) => {
      queryClient.setQueryData<SaasUserListItem>(['saas-user', userId], (prev) =>
        prev ? { ...prev, force_business_plan: forceBusiness } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['saas-users'] });
      queryClient.invalidateQueries({ queryKey: ['saas-user-events', userId] });
      toast.success(forceBusiness ? 'Включён принудительный бизнес-тариф' : 'Принудительный бизнес-тариф выключен');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const manageAdsMutation = useMutation({
    mutationFn: (hideAds: boolean) => saasApi.manageAds(userId, hideAds),
    onSuccess: (_, hideAds) => {
      queryClient.setQueryData<SaasUserListItem>(['saas-user', userId], (prev) =>
        prev ? { ...prev, hide_ads: hideAds } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['saas-users'] });
      queryClient.invalidateQueries({ queryKey: ['saas-user-events', userId] });
      toast.success(hideAds ? 'Показ рекламы отключён' : 'Показ рекламы включён');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const addPaymentMutation = useMutation({
    mutationFn: (amount: number) =>
      saasApi.addPayment(
        userId,
        amount,
        paymentDetails.trim() ? { note: paymentDetails.trim() } : undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-user-events', userId] });
      setPaymentAmount('');
      setPaymentDetails('');
      toast.success('Платёж добавлен');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  if (!Number.isFinite(userId)) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-300">
        Неверный ID пользователя.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-300">
        Ошибка загрузки пользователя.
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-8 text-center text-slate-400">
        Загрузка…
      </div>
    );
  }

  const handleForceBusinessChange = (checked: boolean) => {
    manageAccessMutation.mutate(checked);
  };

  const handleHideAdsChange = (checked: boolean) => {
    manageAdsMutation.mutate(checked);
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(paymentAmount.replace(',', '.'));
    if (Number.isNaN(num) || num <= 0) {
      toast.error('Введите положительную сумму');
      return;
    }
    addPaymentMutation.mutate(num);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/saas-admin/users"
          className="text-slate-400 hover:text-white transition-colors"
          aria-label="Назад к списку"
        >
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold text-white">Пользователь: {user.username}</h1>
      </div>

      <div className="rounded-xl border border-slate-600 bg-slate-800/80 overflow-hidden">
        <div className="p-6 border-b border-slate-600">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-500">ID</dt>
            <dd className="text-white font-mono">{user.id}</dd>
            <dt className="text-slate-500">Логин</dt>
            <dd className="text-white">{user.username}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-white">{user.email || '—'}</dd>
            <dt className="text-slate-500">Имя</dt>
            <dd className="text-white">{[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}</dd>
            <dt className="text-slate-500">Активен</dt>
            <dd className={user.is_active ? 'text-green-400' : 'text-red-400'}>{user.is_active ? 'Да' : 'Нет'}</dd>
            <dt className="text-slate-500">Пространства</dt>
            <dd className="text-slate-300">{user.workspace_count}</dd>
          </dl>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Управление доступом</h2>
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-700/50 border border-slate-600">
            <div>
              <p className="font-medium text-white">Принудительный Бизнес-Тариф</p>
              <p className="text-sm text-slate-400 mt-0.5">
                Включить для пользователя бизнес-тариф без подписки (без рекламы, все функции).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={user.force_business_plan ?? false}
                onChange={(e) => handleForceBusinessChange(e.target.checked)}
                disabled={manageAccessMutation.isPending}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" />
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-700/50 border border-slate-600 mt-4">
            <div>
              <p className="font-medium text-white">Отключить показ рекламы</p>
              <p className="text-sm text-slate-400 mt-0.5">
                Скрыть рекламу для этого пользователя (на личном тарифе).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={user.hide_ads ?? false}
                onChange={(e) => handleHideAdsChange(e.target.checked)}
                disabled={manageAdsMutation.isPending}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" />
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-slate-600">
          <h2 className="text-lg font-semibold text-white mb-3">Статистика и события</h2>
          <p className="text-sm text-slate-400 mb-4">
            Входы в систему, отключение/включение рекламы и бизнес-тарифа, платежи (ручной ввод для аналитики).
          </p>

          <form onSubmit={handleAddPayment} className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-lg bg-slate-700/30 border border-slate-600">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Сумма</label>
              <input
                type="text"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-28 rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-slate-500 mb-1">Комментарий (подписка, способ оплаты)</label>
              <input
                type="text"
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                placeholder="Например: Бизнес на 1 год"
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={addPaymentMutation.isPending || !paymentAmount.trim()}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50"
            >
              Добавить платёж
            </button>
          </form>

          {eventsLoading ? (
            <p className="text-slate-500 text-sm">Загрузка событий…</p>
          ) : events.length === 0 ? (
            <p className="text-slate-500 text-sm">Событий пока нет.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-600">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600 bg-slate-700/50">
                    <th className="px-4 py-2 text-left text-slate-400 font-medium">Дата и время</th>
                    <th className="px-4 py-2 text-left text-slate-400 font-medium">Событие</th>
                    <th className="px-4 py-2 text-right text-slate-400 font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e: SaasUserEvent) => (
                    <tr key={e.id} className="border-b border-slate-600/50">
                      <td className="px-4 py-2 text-slate-300 whitespace-nowrap">
                        {format(new Date(e.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </td>
                      <td className="px-4 py-2 text-white">
                        {EVENT_LABELS[e.event_type] ?? e.event_type}
                        {e.details && Object.keys(e.details).length > 0 && (
                          <span className="text-slate-500 ml-1">
                            ({typeof e.details.note === 'string' ? e.details.note : ''})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-300">
                        {e.amount != null ? `${e.amount} ₽` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
