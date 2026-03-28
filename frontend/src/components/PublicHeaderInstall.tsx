import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

/** Путь на том же домене; на сервере nginx отдаёт из /opt/kanban_python/desktop-releases/ (см. deploy/nginx-kanban-frontend-fix.conf) */
const DEFAULT_WINDOWS_INSTALLER_PATH = '/downloads/AntExpress-Setup.exe';

export default function PublicHeaderInstall() {
  const { canPromptInstall, isInstalled, install } = usePwaInstall();
  const envUrl = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL;
  const desktopUrl =
    typeof envUrl === 'string' && envUrl.trim() !== ''
      ? envUrl.trim()
      : DEFAULT_WINDOWS_INSTALLER_PATH;

  /** Кнопка PWA в шапке, пока не открыто как установленное приложение */
  const showPwaSlot = !isInstalled;

  return (
    <div
      className="flex items-center gap-2 sm:gap-3 shrink-0"
      aria-label="Установка приложения"
    >
      {showPwaSlot ? (
        <button
          type="button"
          title={
            canPromptInstall
              ? 'Установить через браузер (диалог Chrome / Edge)'
              : 'Браузер пока не дал установку. Чаще всего срабатывает Google Chrome или Microsoft Edge.'
          }
          onClick={() => {
            if (canPromptInstall) {
              void install();
              return;
            }
            toast('Откройте сайт в Chrome или Edge — там можно установить приложение на рабочий стол.', {
              duration: 5500,
              icon: '💡',
            });
          }}
          className={
            canPromptInstall
              ? 'text-imperial-muted hover:text-white text-sm font-medium transition-colors whitespace-nowrap'
              : 'text-imperial-muted/85 hover:text-imperial-text text-sm font-medium transition-colors whitespace-nowrap'
          }
        >
          <span className="sm:hidden">Установить</span>
          <span className="hidden sm:inline">Установить приложение</span>
        </button>
      ) : null}
      {showPwaSlot ? (
        <span className="hidden sm:block w-px h-4 bg-white/15 shrink-0 self-center" aria-hidden />
      ) : null}
      <a
        href={desktopUrl}
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-imperial-muted hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
        title="Скачать установщик для Windows (.exe). Положите файл на сервер или задайте VITE_DESKTOP_DOWNLOAD_URL"
      >
        <Download className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
        <span className="sm:hidden">.exe</span>
        <span className="hidden sm:inline">Скачать для Windows</span>
      </a>
    </div>
  );
}
