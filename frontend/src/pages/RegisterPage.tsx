import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { SocialProvider } from '../types';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') ?? undefined;

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    telegram_contact: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, socialLogin } = useAuthStore();
  const [socialProviders, setSocialProviders] = useState<Record<SocialProvider, boolean>>({
    google: false,
    yandex: false,
    telegram: false,
    vk: false,
    mail: false,
  });

  const { data: inviteInfo, isLoading: inviteLoading, error: inviteError } = useQuery({
    queryKey: ['invite-token', inviteToken],
    queryFn: () => authApi.getInviteTokenInfo(inviteToken!),
    enabled: !!inviteToken,
  });

  useEffect(() => {
    if (inviteInfo?.email) {
      setFormData((prev) => ({ ...prev, email: inviteInfo.email }));
    }
  }, [inviteInfo?.email]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const providers = await authApi.getSocialProviders();
        if (!cancelled) setSocialProviders(providers);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const provider = searchParams.get('social_provider') as SocialProvider | null;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    if (!provider) return;
    if (error) {
      toast.error(`Регистрация через ${provider} отклонена или завершилась ошибкой.`);
      return;
    }
    if (!code || !state) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        await socialLogin(provider, code, state);
        if (cancelled) return;
        toast.success(`Вход/регистрация через ${provider} выполнены`);
        navigate('/dashboard');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          `Ошибка регистрации через ${provider}`;
        toast.error(msg);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, socialLogin, navigate]);

  const startSocialRegister = async (provider: SocialProvider) => {
    try {
      setIsLoading(true);
      const { auth_url } = await authApi.getSocialStartUrl(provider, '/register');
      window.location.href = auth_url;
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        `Не удалось начать регистрацию через ${provider}`;
      toast.error(msg);
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      toast.error('Пароли не совпадают');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Пароль должен содержать минимум 8 символов');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authApi.register({
        username: formData.username,
        password: formData.password,
        email: formData.email,
        telegram_contact: formData.telegram_contact,
        ...(inviteToken && { invite_token: inviteToken }),
      });

      // Сохраняем токены
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      localStorage.setItem('user', JSON.stringify(response.user));

      // Обновляем store
      setUser(response.user);

      toast.success('Регистрация успешна!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Регистрация</h1>
          {inviteToken && inviteLoading && (
            <p className="text-gray-600">Проверка приглашения…</p>
          )}
          {inviteToken && inviteInfo && (
            <p className="text-gray-700 font-medium">
              Присоединяйтесь к <span className="text-primary-600">{inviteInfo.workspace_name}</span> как {inviteInfo.contact_name}
            </p>
          )}
          {inviteToken && inviteError && (
            <p className="text-red-600 text-sm">Приглашение недействительно или истекло.</p>
          )}
          {!inviteToken && <p className="text-gray-600">Создайте новый аккаунт</p>}
        </div>

        {(socialProviders.google || socialProviders.yandex || socialProviders.vk || socialProviders.mail || socialProviders.telegram) && (
          <div className="mb-6 p-3 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600 mb-2 text-center">Быстрая регистрация через</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {socialProviders.google && (
                <button
                  type="button"
                  onClick={() => startSocialRegister('google')}
                  className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-sm"
                >
                  Google
                </button>
              )}
              {socialProviders.yandex && (
                <button
                  type="button"
                  onClick={() => startSocialRegister('yandex')}
                  className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-sm"
                >
                  Яндекс
                </button>
              )}
              {socialProviders.vk && (
                <button
                  type="button"
                  onClick={() => startSocialRegister('vk')}
                  className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-sm"
                >
                  VK
                </button>
              )}
              {socialProviders.mail && (
                <button
                  type="button"
                  onClick={() => startSocialRegister('mail')}
                  className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-sm"
                >
                  Mail
                </button>
              )}
              {socialProviders.telegram && (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-sm"
                >
                  Telegram (через страницу входа)
                </button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Имя пользователя *
            </label>
            <input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Введите имя пользователя"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => !inviteToken && setFormData({ ...formData, email: e.target.value })}
              readOnly={!!inviteToken}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label htmlFor="telegram_contact" className="block text-sm font-medium text-gray-700 mb-2">
              Telegram контакт *
            </label>
            <input
              id="telegram_contact"
              type="text"
              value={formData.telegram_contact}
              onChange={(e) => setFormData({ ...formData, telegram_contact: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="@username или +79991234567"
            />
            <p className="text-xs text-gray-500 mt-1">
              Укажите ваш Telegram username (например: @username) или номер телефона
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Пароль *
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Минимум 8 символов"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Подтверждение пароля *
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              minLength={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Повторите пароль"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Отправка...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Войти
            </Link>
          </p>
          <p className="pt-2">
            <Link to="/landing" className="text-sm text-gray-500 hover:text-primary-600 font-medium inline-flex items-center gap-1">
              ← Назад на главную
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
