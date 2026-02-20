import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saasApi, type SaasUserListItem } from '../../api/saas';
import { apiClient } from '../../api/client';
import toast from 'react-hot-toast';

export default function SaasUsersPage() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['saas-users'],
    queryFn: () => saasApi.getUsers(),
  });

  const banMutation = useMutation({
    mutationFn: (userId: number) => saasApi.banUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-users'] });
      toast.success('Статус пользователя обновлён');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const handleImpersonate = async (userId: number) => {
    try {
      const { access, refresh } = await saasApi.impersonate(userId);
      apiClient.setTokens({ access, refresh });
      toast.success('Вход выполнен под выбранным пользователем');
      window.location.href = '/';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка входа');
    }
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-300">
        Ошибка загрузки пользователей.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Пользователи</h1>

      {isLoading ? (
        <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-8 text-center text-slate-400">Загрузка…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-600 bg-slate-800/80">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Логин / Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Имя</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Активен</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Пространства</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Дата</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: SaasUserListItem) => (
                <tr key={u.id} className="border-b border-slate-600/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-400">{u.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/saas-admin/users/${u.id}`} className="font-medium text-white hover:text-red-200">
                      {u.username}
                    </Link>
                    {u.email && <span className="block text-sm text-slate-500">{u.email}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={u.is_active ? 'text-green-400' : 'text-red-400'}>
                      {u.is_active ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400">{u.workspace_count}</td>
                  <td className="px-4 py-3 text-slate-500 text-sm">
                    {u.date_joined ? new Date(u.date_joined).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleImpersonate(u.id)}
                        className="text-sm px-2 py-1 rounded border border-red-500/50 text-red-300 hover:bg-red-500/20"
                      >
                        Войти как
                      </button>
                      {!u.is_superuser && (
                        <button
                          type="button"
                          onClick={() => banMutation.mutate(u.id)}
                          disabled={banMutation.isPending}
                          className="text-sm px-2 py-1 rounded border border-slate-500 text-slate-400 hover:bg-slate-600"
                        >
                          {u.is_active ? 'Заблокировать' : 'Разблокировать'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
