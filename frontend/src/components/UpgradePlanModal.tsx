/**
 * Модалка «Улучшите тариф» (SaaS Sprint 2).
 * Показывается при 403 LIMIT_REACHED или FEATURE_LOCKED.
 */
import { useUpgradeModalStore } from '../store/upgradeModalStore';

export default function UpgradePlanModal() {
  const { open, code, detail, closeModal } = useUpgradeModalStore();

  if (!open) return null;

  const title = code === 'LIMIT_REACHED'
    ? 'Достигнут лимит'
    : 'Функция недоступна на вашем тарифе';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-imperial-surface p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
      >
        <h2 id="upgrade-modal-title" className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Улучшите свой тариф
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-1">
          {title}
        </p>
        {detail && (
          <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
            {detail}
          </p>
        )}
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Вы достигли лимита возможностей текущего плана. Перейдите на Pro для расширенных возможностей.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            Закрыть
          </button>
          <a
            href="mailto:support@example.com?subject=Запрос на тариф Pro"
            className="px-4 py-2 rounded-xl bg-imperial-gold text-black font-medium hover:bg-amber-400"
          >
            Связаться с менеджером
          </a>
        </div>
      </div>
    </div>
  );
}
