/**
 * Определение платформы запуска приложения (веб, Tauri desktop, Telegram WebApp и т.д.).
 * Используется для условного отображения элементов (например, скрыть "Скачать приложение" внутри десктопа).
 */

import { isTauriRuntime } from '../lib/apiBase';

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    Telegram?: { WebApp?: unknown };
  }
}

/** Приложение запущено в нативном окне Tauri (desktop). Учитывает host/protocol, не только __TAURI__. */
export const isTauri = typeof window !== 'undefined' && isTauriRuntime();

/** Приложение открыто как Telegram Mini App (WebApp). */
export const isTelegramWebApp =
  typeof window !== 'undefined' && Boolean((window as Window).Telegram?.WebApp);

/** Обычный браузер (не Tauri, не Telegram). */
export const isWeb = !isTauri && !isTelegramWebApp;
