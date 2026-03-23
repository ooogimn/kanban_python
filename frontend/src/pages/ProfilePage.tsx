import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import type { UserProfile, UserProfileUpdate } from '../types';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<UserProfileUpdate>({
    first_name: '',
    last_name: '',
    email: '',
    timezone: 'Europe/Moscow',
    telegram_username: '',
  });
  const [telegramCode, setTelegramCode] = useState('');
  const isTelegramWebApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
    retry: 1,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        email: profile.email ?? '',
        timezone: profile.timezone ?? 'Europe/Moscow',
        telegram_username: profile.telegram_username ?? '',
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: UserProfileUpdate) => authApi.updateProfile(data),
    onSuccess: (updated: UserProfile) => {
      queryClient.setQueryData(['profile'], updated);
      setUser({
        id: updated.id,
        username: updated.username,
        email: updated.email,
        first_name: updated.first_name,
        last_name: updated.last_name,
        telegram_username: updated.telegram_username,
      });
      toast.success('Профиль сохранён');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения профиля');
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: (updated: UserProfile) => {
      queryClient.setQueryData(['profile'], updated);
      toast.success('Аватар обновлён');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Ошибка загрузки аватара');
    },
  });

  const getTelegramLinkMutation = useMutation({
    mutationFn: () => authApi.getTelegramLink(),
    onSuccess: (data) => {
      if (data.link) {
        window.open(data.link, '_blank', 'noopener,noreferrer');
        toast.success('Откройте ссылку в Telegram и нажмите Start');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Не удалось получить ссылку');
    },
  });

  const linkTelegramByCodeMutation = useMutation({
    mutationFn: (code: string) => authApi.linkTelegramByCode(code),
    onSuccess: async () => {
      setTelegramCode('');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      const profileData = queryClient.getQueryData<UserProfile>(['profile']);
      if (profileData && user) {
        setUser({
          ...user,
          telegram_id: profileData.telegram_id,
          telegram_username: profileData.telegram_username ?? user.telegram_username,
        });
      }
      toast.success('Telegram успешно привязан');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Неверный или истёкший код');
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Допустимые форматы: JPEG, PNG, GIF, WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Размер файла не более 5 МБ');
      return;
    }
    avatarMutation.mutate(file);
    e.target.value = '';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  if (isLoading || (!profile && !isError)) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-slate-500 dark:text-slate-400">Загрузка профиля…</p>
      </div>
    );
  }

  if (isError) {
    const status = (error as any)?.response?.status;
    const message = (error as any)?.response?.data?.detail || (error as Error)?.message || 'Не удалось загрузить профиль';
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-slate-600 dark:text-slate-300 font-medium">Ошибка загрузки профиля</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center max-w-md">{message}</p>
        {status === 401 ? (
          <Link
            to="/login?next=/profile"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Войти снова
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            Повторить
          </button>
        )}
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Личный кабинет</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Редактирование данных профиля, аватар, смена пароля и выход из аккаунта.
      </p>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Блок с аватаром и именем */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              className="relative group shrink-0 rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              title="Загрузить аватар"
            >
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                  className="w-20 h-20 object-cover border-2 border-slate-200 dark:border-slate-600 rounded-xl"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {displayName[0]?.toUpperCase() || profile.username[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs font-medium">
                {avatarMutation.isPending ? 'Загрузка…' : 'Сменить'}
              </span>
            </button>
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">@{profile.username}</p>
              {profile.date_joined && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  В системе с {new Date(profile.date_joined).toLocaleDateString('ru-RU')}
                </p>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Имя пользователя (логин)
            </label>
            <input
              type="text"
              value={profile.username}
              readOnly
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">Изменить логин нельзя</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Имя
              </label>
              <input
                id="first_name"
                type="text"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Имя"
              />
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Фамилия
              </label>
              <input
                id="last_name"
                type="text"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Фамилия"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label htmlFor="telegram_username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Telegram (без @)
            </label>
            <input
              id="telegram_username"
              type="text"
              value={form.telegram_username}
              onChange={(e) => setForm((f) => ({ ...f, telegram_username: e.target.value.replace(/^@/, '') }))}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="username"
            />
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Часовой пояс
            </label>
            <select
              id="timezone"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="Europe/Moscow">Москва (Europe/Moscow)</option>
              <option value="Europe/Samara">Самара (Europe/Samara)</option>
              <option value="Asia/Yekaterinburg">Екатеринбург (Asia/Yekaterinburg)</option>
              <option value="Asia/Novosibirsk">Новосибирск (Asia/Novosibirsk)</option>
              <option value="Asia/Vladivostok">Владивосток (Asia/Vladivostok)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          {/* Интеграция с Telegram */}
          <div
            className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3"
            data-telegram-webapp={isTelegramWebApp ? 'true' : undefined}
          >
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Интеграция с Telegram
            </h3>
            {profile.telegram_id ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-sm font-medium">
                  ✓ Привязан
                </span>
                {profile.telegram_username && (
                  <span className="text-slate-600 dark:text-slate-400 text-sm">
                    @{profile.telegram_username}
                  </span>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 w-full">
                  Уведомления о назначенных задачах приходят в Telegram.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Свяжите аккаунт с Telegram, чтобы получать уведомления о задачах.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => getTelegramLinkMutation.mutate()}
                    disabled={getTelegramLinkMutation.isPending}
                    className="px-4 py-2 bg-[#0088cc] text-white rounded-lg font-medium hover:bg-[#0077b5] focus:outline-none focus:ring-2 focus:ring-[#0088cc] focus:ring-offset-2 disabled:opacity-50 transition-colors"
                  >
                    {getTelegramLinkMutation.isPending ? 'Загрузка…' : 'Связать через Telegram'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Или введите код из бота (отправьте /start боту и скопируйте код):
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={telegramCode}
                    onChange={(e) => setTelegramCode(e.target.value)}
                    placeholder="start_..."
                    className="flex-1 min-w-[180px] px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const code = telegramCode.trim();
                      if (code) linkTelegramByCodeMutation.mutate(code);
                      else toast.error('Введите код из бота');
                    }}
                    disabled={!telegramCode.trim() || linkTelegramByCodeMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {linkTelegramByCodeMutation.isPending ? 'Проверка…' : 'Подтвердить'}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>

        {/* Смена пароля и Выйти */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center gap-4">
          <Link
            to="/settings/password"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            🔒 Смена пароля
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            🚪 Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
