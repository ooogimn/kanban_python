/**
 * Базовый URL API. В браузере на сайте — относительный /api/v1 (nginx → бэкенд).
 * В Tauri нет того же origin — явно продакшен API (тот же, что у antexpress.ru на сервере).
 */
export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  if (w.__TAURI__ ?? w.__TAURI_INTERNALS__) return true;
  // Маркеры Tauri часто появляются позже импорта модулей; host/protocol доступны сразу (Tauri 2).
  try {
    const { protocol, hostname } = window.location;
    if (protocol === 'tauri:') return true;
    const h = hostname.toLowerCase();
    if (h === 'tauri.localhost' || h === 'asset.localhost' || h === 'ipc.localhost') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Сборка, сделанная через `tauri build` — в процессе Vite CLI задаёт TAURI_ENV_PLATFORM (windows/darwin/linux).
 * Надёжнее, чем только runtime: в WebView2 иногда нет __TAURI__ / не тот hostname при первом запросе.
 */
export function isTauriBundledBuild(): boolean {
  const p = import.meta.env.TAURI_ENV_PLATFORM;
  return typeof p === 'string' && p.length > 0;
}

/** Десктоп Tauri или его сборка — для API baseURL и текстов ошибок вместо хинтов про localhost:8000 */
export function isTauriAppContext(): boolean {
  return isTauriBundledBuild() || isTauriRuntime();
}

/** Продакшен API (совпадает с api.antexpress.ru на сервере). Переопределение: VITE_API_URL при сборке. */
const PRODUCTION_API_V1 = 'https://api.antexpress.ru/api/v1';

export function getRawApiUrl(): string {
  const env = (import.meta.env.VITE_API_URL || '').trim();
  if (env) return env;
  if (isTauriAppContext()) return PRODUCTION_API_V1;
  return '/api/v1';
}

/** Нормализация к виду .../api/v1 без завершающего слэша */
export function normalizeApiV1Base(raw: string): string {
  const t = raw.trim();
  if (!t) return '/api/v1';
  return t.endsWith('/api/v1') || t.endsWith('/api/v1/')
    ? t.replace(/\/+$/, '')
    : `${t.replace(/\/+$/, '')}/api/v1`;
}

export function getApiV1Base(): string {
  return normalizeApiV1Base(getRawApiUrl());
}

/** HTTP(S) origin без /api/v1 — для WebSocket wss:// */
export function getHttpOriginForWs(): string {
  const base = getApiV1Base();
  if (base.startsWith('http')) {
    return base.replace(/\/api\/v1\/?$/, '') || 'https://api.antexpress.ru';
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return 'http://localhost:8000';
}
