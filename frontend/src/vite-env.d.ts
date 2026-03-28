/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vitest/globals" />

declare module 'react-big-calendar';

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Прямая ссылка на установщик/страницу релиза Tauri (Windows). Показывается в шапке лендинга. */
  readonly VITE_DESKTOP_DOWNLOAD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
