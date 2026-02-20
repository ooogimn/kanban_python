import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { TelegramAuthData } from '../types';
import toast from 'react-hot-toast';

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
  const { login, telegramLogin } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('next') || '/dashboard';
  const telegramWidgetRef = useRef<HTMLDivElement>(null);

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
          <img src="/OS_LOGO.png" alt="OS LukintrLab" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">OS LukintrLab</h1>
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

        {TELEGRAM_BOT_USERNAME && (
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
        </div>
      </div>
    </div>
  );
}
