import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthTokens } from '../types';
import { useUpgradeModalStore } from '../store/upgradeModalStore';

// В dev с Vite proxy используем относительный URL — один origin, стабильнее и без CORS.
// Всегда приводим к базе с /api/v1, иначе запросы вроде /auth/me/ дают 404 (нужен /api/v1/auth/me/).
const raw = (import.meta.env.VITE_API_URL || '/api/v1').trim();
const API_BASE_URL = raw.endsWith('/api/v1') || raw.endsWith('/api/v1/')
  ? raw.replace(/\/+$/, '')
  : raw ? `${raw.replace(/\/+$/, '')}/api/v1` : '/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - добавляем токен
    this.client.interceptors.request.use(
      (config) => {
        // Если отправляем FormData (например, логотип проекта), убираем json заголовок
        if (config.data instanceof FormData) {
          config.headers = config.headers ?? {};
          delete (config.headers as any)['Content-Type'];
          (config.headers as any)['Content-Type'] = 'multipart/form-data';
        }
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - обрабатываем ошибки и обновляем токен
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;
        const isLoginRequest =
          originalRequest?.url?.includes('/auth/login') ||
          originalRequest?.url?.includes('/auth/telegram');

        // Сеть недоступна (бэкенд не запущен, CORS, таймаут)
        if (!error.response) {
          const msg = error.code === 'ERR_NETWORK'
            ? 'Сервер недоступен. Проверьте: 1) Backend запущен (python manage.py runserver); 2) Порт 8000 свободен.'
            : (error.message || 'Ошибка сети');
          return Promise.reject(new Error(msg));
        }

        // 403 с кодом LIMIT_REACHED или FEATURE_LOCKED — открыть модалку апгрейда (SaaS Sprint 2)
        if (error.response?.status === 403) {
          const data = error.response?.data as { code?: string; detail?: string } | undefined;
          const code = data?.code;
          if (code === 'LIMIT_REACHED' || code === 'FEATURE_LOCKED') {
            useUpgradeModalStore.getState().openModal(code, data?.detail ?? null);
          }
        }

        // 401 на логине — не обновляем токен, сразу отдаём ошибку (неверный логин/пароль)
        if (error.response?.status === 401 && isLoginRequest) {
          return Promise.reject(error);
        }

        // Если 401 и это не запрос на обновление токена — пробуем refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
                refresh: refreshToken,
              });
              const { access } = response.data;
              localStorage.setItem('access_token', access);
              originalRequest.headers.Authorization = `Bearer ${access}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            const path = typeof window !== 'undefined' ? window.location.pathname : '/';
            window.location.href = path && path !== '/login' ? `/login?next=${encodeURIComponent(path)}` : '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  get instance() {
    return this.client;
  }

  setTokens(tokens: AuthTokens) {
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
  }

  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }
}

export const apiClient = new ApiClient();
export default apiClient.instance;
