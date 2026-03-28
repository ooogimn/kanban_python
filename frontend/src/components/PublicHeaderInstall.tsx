import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

const PWA_FALLBACK_HINT =
  'Chrome / Edge: меню «⋯» → «Установить приложение…» или значок установки в адресной строке. Safari (iPhone): «Поделиться» → «На экран «Домой»».';

export default function PublicHeaderInstall() {
  const { canPromptInstall, isInstalled, install } = usePwaInstall();
  const desktopUrl = (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL || '').trim();

  if (isInstalled && !desktopUrl) {
    return null;
  }

  return (
    <>
      {!isInstalled && (
        <button
          type="button"
          title={canPromptInstall ? 'Установить AntExpress как приложение' : PWA_FALLBACK_HINT}
          onClick={() => {
            if (canPromptInstall) {
              void install();
              return;
            }
            toast(PWA_FALLBACK_HINT, { duration: 8000, icon: '📲' });
          }}
          className="text-imperial-muted hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
        >
          <span className="sm:hidden">PWA</span>
          <span className="hidden sm:inline">Установить приложение</span>
        </button>
      )}
      {desktopUrl ? (
        <a
          href={desktopUrl}
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-imperial-muted hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
          title="Нативное приложение для Windows (Tauri)"
        >
          <Download className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
          <span className="hidden sm:inline">Windows</span>
        </a>
      ) : null}
    </>
  );
}
