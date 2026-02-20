import { useState, useEffect } from 'react';

const STORAGE_KEY = 'cookie_consent';

export type CookieConsentChoice = 'all' | 'necessary' | 'none';

export default function CookieConsentBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const save = (choice: CookieConsentChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] flex flex-wrap items-center justify-between gap-4 px-4 py-4 bg-slate-900/95 border-t border-cyan-500/20 shadow-[0_-4px 24px rgba(0,0,0,0.3)] backdrop-blur-sm"
      role="dialog"
      aria-label="Согласие на использование cookie"
    >
      <p className="text-sm text-slate-200 max-w-2xl">
        Мы используем cookie для работы сайта, аналитики и улучшения сервиса. Вы можете разрешить все
        cookie, только необходимые для работы сайта или отклонить необязательные.
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => save('all')}
          className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-900 font-medium hover:bg-cyan-400 transition-colors text-sm whitespace-nowrap"
        >
          Принять все
        </button>
        <button
          type="button"
          onClick={() => save('necessary')}
          className="px-4 py-2 rounded-lg border border-cyan-400/60 text-cyan-300 font-medium hover:bg-cyan-400/20 transition-colors text-sm whitespace-nowrap"
        >
          Только необходимые
        </button>
        <button
          type="button"
          onClick={() => save('none')}
          className="px-4 py-2 rounded-lg border border-slate-500 text-slate-300 font-medium hover:bg-slate-700/50 transition-colors text-sm whitespace-nowrap"
        >
          Не включать
        </button>
      </div>
    </div>
  );
}
