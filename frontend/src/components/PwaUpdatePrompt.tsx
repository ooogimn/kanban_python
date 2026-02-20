/**
 * PWA update prompt — shows toast when new version is available.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_, registration) {
      registration &&
        setInterval(
          () => registration.update(),
          60 * 60 * 1000
        );
    },
    onRegisterError(error) {
      console.warn('SW registration error', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast('Готово к работе офлайн', { icon: '✓', duration: 3000 });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <span className="text-sm">Доступна новая версия</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  updateServiceWorker(true);
                  toast.dismiss(t.id);
                }}
                className="rounded-lg bg-imperial-gold px-3 py-1.5 text-sm font-medium text-black"
              >
                Обновить
              </button>
              <button
                type="button"
                onClick={() => {
                  setNeedRefresh(false);
                  toast.dismiss(t.id);
                }}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm"
              >
                Позже
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'pwa-update' }
      );
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
