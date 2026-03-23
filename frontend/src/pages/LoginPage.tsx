import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { TelegramAuthData, SocialProvider } from '../types';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';
import BrandWordmark from '../components/BrandWordmark';

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';

function parseTelegramHash(hash: string): TelegramAuthData | null {
  if (!hash || !hash.startsWith('#')) return null;
  const params = new URLSearchParams(hash.slice(1));
  const id = params.get('id');
  const auth_date = params.get('auth_date');
  const hashVal = params.get('hash');
  if (!id || !auth_date || !hashVal) return null;
  return {
    id: Number(id),
    first_name: params.get('first_name') || '',
    last_name: params.get('last_name') || undefined,
    username: params.get('username') || undefined,
    photo_url: params.get('photo_url') || undefined,
    auth_date: Number(auth_date),
    hash: hashVal,
  };
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, telegramLogin, socialLogin } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('next') || '/dashboard';
  const telegramWidgetRef = useRef<HTMLDivElement>(null);
  const [socialProviders, setSocialProviders] = useState<Record<SocialProvider, boolean>>({
    google: false,
    yandex: false,
    telegram: Boolean(TELEGRAM_BOT_USERNAME),
    vk: false,
    mail: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const providers = await authApi.getSocialProviders();
        if (!cancelled) setSocialProviders(providers);
      } catch {
        // ignore: fallback to env-based Telegram only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Обработка возврата из Telegram Login Widget (редирект с hash в URL)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const data = parseTelegramHash(hash);
    if (!data) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        await telegramLogin(data);
        if (cancelled) return;
        toast.success('Вход через Telegram выполнен');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        navigate(returnTo.startsWith('/') ? returnTo : '/dashboard');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Ошибка входа через Telegram';
        toast.error(msg);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [telegramLogin, navigate]);

  // OAuth callback: /login?social_provider=google&code=...&state=...
  useEffect(() => {
    const provider = searchParams.get('social_provider') as SocialProvider | null;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    if (!provider) return;
    if (error) {
      toast.error(`Вход через ${provider} отклонён или завершился ошибкой.`);
      return;
    }
    if (!code || !state) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        await socialLogin(provider, code, state);
        if (cancelled) return;
        toast.success(`Вход через ${provider} выполнен`);
        navigate(returnTo.startsWith('/') ? returnTo : '/dashboard');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          `Ошибка входа через ${provider}`;
        toast.error(msg);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, socialLogin, navigate, returnTo]);

  const startSocialLogin = async (provider: SocialProvider) => {
    try {
      setIsLoading(true);
      const { auth_url } = await authApi.getSocialStartUrl(provider, '/login');
      window.location.href = auth_url;
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        `Не удалось начать вход через ${provider}`;
      toast.error(msg);
      setIsLoading(false);
    }
  };

  // Подключение Telegram Login Widget (скрипт с data-telegram-login)
  useEffect(() => {
    if (!TELEGRAM_BOT_USERNAME || !telegramWidgetRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', window.location.origin + '/login');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    telegramWidgetRef.current.appendChild(script);
    return () => {
      telegramWidgetRef.current?.removeChild(script);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(username, password);
      toast.success('Вход выполнен успешно');
      navigate(returnTo.startsWith('/') ? returnTo : '/dashboard');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string | string[] }; status?: number }; message?: string };
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail) && detail[0]
            ? String(detail[0])
            : err?.response?.status === 401
              ? 'Неверные имя пользователя или пароль.'
              : err?.response?.data
                ? 'Ошибка входа. Проверьте данные и попробуйте снова.'
                : err?.message || 'Ошибка входа. Проверьте подключение к интернету.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <img src="/OS_LOGO.png?v=20260320" alt="AntExpress" className="w-32 h-32 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            <BrandWordmark />
          </h1>
          <p className="text-slate-600 dark:text-slate-400">Войдите в свой аккаунт</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Имя пользователя, Email или Telegram
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              placeholder="username, email@example.com или @telegram"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Можно войти по username, email или Telegram username
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              placeholder="Введите пароль"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        {(socialProviders.google || socialProviders.yandex || socialProviders.vk || socialProviders.mail) && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-600">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 text-center">Быстрый вход через</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {socialProviders.google && (
                <button
                  type="button"
                  onClick={() => startSocialLogin('google')}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                >
                  Google
                </button>
              )}
              {socialProviders.yandex && (
                <button
                  type="button"
                  onClick={() => startSocialLogin('yandex')}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                >
                  Яндекс
                </button>
              )}
              {socialProviders.vk && (
                <button
                  type="button"
                  onClick={() => startSocialLogin('vk')}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                >
                  VK
                </button>
              )}
              {socialProviders.mail && (
                <button
                  type="button"
                  onClick={() => startSocialLogin('mail')}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                >
                  Mail
                </button>
              )}
            </div>
          </div>
        )}

        {(TELEGRAM_BOT_USERNAME || socialProviders.telegram) && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-600 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Или войти через Telegram</p>
            <div ref={telegramWidgetRef} className="flex justify-center min-h-[44px]" />
          </div>
        )}

        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Нет аккаунта?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium">
              Зарегистрироваться
            </Link>
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Забыли пароль?{' '}
            <Link to="/forgot-password" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium">
              Восстановить пароль
            </Link>
          </p>
          <p className="pt-2">
            <Link to="/landing" className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium inline-flex items-center gap-1">
              ← Назад на главную
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
