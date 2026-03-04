import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getCookieConsent,
  onOpenCookieConsentSettings,
  setCookieConsent,
  type CookieConsentChoice,
} from '../lib/cookieConsent';

export default function CookieConsentBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = getCookieConsent();
    if (saved === null) setVisible(true);

    const unsubscribe = onOpenCookieConsentSettings(() => {
      setVisible(true);
    });

    return unsubscribe;
  }, []);

  const save = (choice: CookieConsentChoice) => {
    setCookieConsent(choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] flex flex-wrap items-center justify-between gap-4 px-4 py-4 bg-slate-900/95 border-t border-cyan-500/20 shadow-[0_-4px 24px rgba(0,0,0,0.3)] backdrop-blur-sm"
      role="dialog"
      aria-label="Согласие на использование cookie"
    >
      <div className="max-w-2xl">
        <p className="text-sm text-slate-200">
          Мы используем cookie для работы сайта, аналитики и улучшения сервиса. Вы можете разрешить все
          cookie, только необходимые для работы сайта или отклонить необязательные.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Подробнее: <Link to="/privacy" className="text-cyan-300 hover:text-cyan-200 underline">Политика конфиденциальности</Link>,{' '}
          <Link to="/personal-data" className="text-cyan-300 hover:text-cyan-200 underline">Политика обработки ПДн</Link>,{' '}
          <Link to="/legal/contacts" className="text-cyan-300 hover:text-cyan-200 underline">Контакты</Link>.
        </p>
      </div>
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
