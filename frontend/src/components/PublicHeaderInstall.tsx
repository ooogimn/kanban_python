import { Download } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export default function PublicHeaderInstall() {
  const { canPromptInstall, isInstalled, install } = usePwaInstall();
  const desktopUrl = (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL || '').trim();

  const showPwa = !isInstalled && canPromptInstall;
  const showDesktop = Boolean(desktopUrl);

  if (isInstalled && !showDesktop) {
    return null;
  }
  if (!showPwa && !showDesktop) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 sm:gap-3 shrink-0"
      aria-label="Установка приложения"
    >
      {showPwa ? (
        <button
          type="button"
          title="Установить через браузер (тот же диалог, что в Chrome)"
          onClick={() => void install()}
          className="text-imperial-muted hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
        >
          <span className="sm:hidden">Установить</span>
          <span className="hidden sm:inline">Установить приложение</span>
        </button>
      ) : null}
      {showPwa && showDesktop ? (
        <span className="hidden sm:block w-px h-4 bg-white/15 shrink-0 self-center" aria-hidden />
      ) : null}
      {showDesktop ? (
        <a
          href={desktopUrl}
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-imperial-muted hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
          title="Скачать установщик для Windows (Tauri, отдельное окно как в dev)"
        >
          <Download className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
          <span className="sm:hidden">.exe</span>
          <span className="hidden sm:inline">Приложение Windows</span>
        </a>
      ) : null}
    </div>
  );
}
