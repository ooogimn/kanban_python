import toast from 'react-hot-toast';
import { Download, MonitorSmartphone } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { getDesktopInstallerHref } from '../../lib/desktopInstall';

/**
 * Страница личного кабинета: как установить PWA из браузера и скачать десктоп для Windows.
 */
export default function AccountInstallPage() {
  const { canPromptInstall, isInstalled, install } = usePwaInstall();
  const desktopUrl = getDesktopInstallerHref();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Приложение AntExpress</h1>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Установите сервис как приложение на компьютер или добавьте ярлык на рабочий стол из браузера — вход тот же,
          что и на сайте.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/20 text-red-300">
            <MonitorSmartphone className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium text-white">Из браузера (PWA)</h2>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">
              Рекомендуем <strong className="text-slate-300 font-medium">Google Chrome</strong> или{' '}
              <strong className="text-slate-300 font-medium">Microsoft Edge</strong>. Откройте этот сайт в одном из них
              — тогда появится возможность установить приложение через системный диалог.
            </p>
            <ul className="mt-3 text-sm text-slate-400 list-disc pl-5 space-y-1">
              <li>Если кнопка ниже неактивна: в меню браузера выберите «Установить приложение» / «Install app».</li>
              <li>После установки ярлык появится на рабочем столе или в меню «Пуск».</li>
            </ul>
          </div>
        </div>
        {isInstalled ? (
          <p className="text-sm text-emerald-400/90 pl-[52px]">Вы уже открыли AntExpress как установленное приложение.</p>
        ) : (
          <div className="pl-[52px] pt-1">
            <button
              type="button"
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
                  ? 'inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition-colors'
                  : 'inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors'
              }
            >
              Установить из браузера
            </button>
            {!canPromptInstall && (
              <p className="mt-2 text-xs text-slate-500">
                Кнопка станет активной, когда браузер предложит установку (обычно после нескольких визитов на сайт).
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-200">
            <Download className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium text-white">Windows (установщик)</h2>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">
              Скачайте файл <code className="text-slate-300">.exe</code>, запустите его и следуйте шагам мастера.
              Обновления приложения ставятся так же — скачайте новый установщик с этой страницы при выходе версии.
            </p>
          </div>
        </div>
        <div className="pl-[52px] pt-1">
          <a
            href={desktopUrl}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-imperial-gold px-5 py-2.5 text-sm font-medium text-imperial-bg hover:bg-amber-500 transition-colors"
          >
            <Download className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Скачать для Windows
          </a>
        </div>
      </section>
    </div>
  );
}
