/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vitest/globals" />

declare module 'react-big-calendar';

interface ImportMetaEnv {
  /** Задаётся только при `tauri build` / dev через CLI — целевая ОС (windows, darwin, linux). */
  readonly TAURI_ENV_PLATFORM?: string;
  /** Если задан — переопределяет базу API (и веб, и Tauri). Иначе веб: /api/v1, Tauri: продакшен API. */
  readonly VITE_API_URL?: string;
  /** Прямая ссылка на установщик/страницу релиза Tauri (Windows). Показывается в шапке лендинга. */
  readonly VITE_DESKTOP_DOWNLOAD_URL?: string;
  /** Канонический origin для поля manifest `id` (без слэша в конце), например https://antexpress.ru */
  readonly VITE_PWA_APP_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
