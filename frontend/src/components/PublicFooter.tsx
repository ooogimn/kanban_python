import { Link } from 'react-router-dom';
import { COMPANY } from '../lib/companyInfo';
import { openCookieConsentSettings } from '../lib/cookieConsent';
import BrandWordmark from './BrandWordmark';

/**
 * PublicFooter — футер для всех публичных страниц (лендинг, блог, юр. страницы).
 * Содержит реквизиты, навигацию по правовым документам, соцсети.
 * Соответствует требованиям ФЗ-149, ФЗ-152, Закона о рекламе.
 */
export default function PublicFooter() {
    const year = COMPANY.currentYear;
    const since = COMPANY.foundedYear;

    return (
        <footer className="border-t border-white/10 bg-imperial-surface/60 backdrop-blur-sm mt-auto">
            <div className="max-w-6xl mx-auto px-4 py-10">

                {/* Верхняя часть: 4 колонки */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">

                    {/* Колонка 1: О компании */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <img src="/OS_LOGO.png?v=20260320" alt="" className="w-7 h-7 rounded-md object-contain bg-white/10" />
                            <BrandWordmark className="font-bold text-sm" />
                        </div>
                        <p className="text-xs text-imperial-muted leading-relaxed mb-3">
                            Офисная платформа «всё-в-одном»: задачи, Kanban, Gantt, HR, финансы и ИИ-агенты.
                        </p>
                        <p className="text-xs text-imperial-muted">
                            {COMPANY.shortName}<br />
                            ИНН: {COMPANY.inn} | ОГРН: {COMPANY.ogrn}
                        </p>
                    </div>

                    {/* Колонка 2: Платформа */}
                    <div>
                        <h3 className="text-xs font-semibold text-white uppercase tracking-widest mb-3">Платформа</h3>
                        <ul className="space-y-2">
                            {[
                                { to: '/landing', label: 'О сервисе' },
                                { to: '/landing#pricing', label: 'Тарифы' },
                                { to: '/blog', label: 'Блог' },
                                { to: '/register', label: 'Начать бесплатно' },
                                { to: '/login', label: 'Войти' },
                            ].map(({ to, label }) => (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        className="text-xs text-imperial-muted hover:text-white transition-colors"
                                    >
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Колонка 3: Правовые документы */}
                    <div>
                        <h3 className="text-xs font-semibold text-white uppercase tracking-widest mb-3">Документы</h3>
                        <ul className="space-y-2">
                            {[
                                { to: '/terms', label: 'Пользовательское соглашение' },
                                { to: '/offer', label: 'Публичная оферта' },
                                { to: '/privacy', label: 'Политика конфиденциальности' },
                                { to: '/personal-data', label: 'Обработка персональных данных' },
                                { to: '/cookies', label: 'Политика Cookie' },
                                { to: '/legal/contacts', label: 'Реквизиты компании' },
                            ].map(({ to, label }) => (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        className="text-xs text-imperial-muted hover:text-white transition-colors"
                                    >
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Колонка 4: Контакты */}
                    <div>
                        <h3 className="text-xs font-semibold text-white uppercase tracking-widest mb-3">Контакты</h3>
                        <ul className="space-y-2 text-xs text-imperial-muted">
                            <li>
                                <a
                                    href={`tel:${COMPANY.phoneTel}`}
                                    className="hover:text-white transition-colors flex items-center gap-1.5"
                                >
                                    📞 {COMPANY.phone}
                                </a>
                            </li>
                            <li>
                                <a
                                    href={`mailto:${COMPANY.email}`}
                                    className="hover:text-white transition-colors flex items-center gap-1.5"
                                >
                                    ✉️ {COMPANY.email}
                                </a>
                            </li>
                            <li>
                                <a
                                    href={COMPANY.telegramUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-white transition-colors flex items-center gap-1.5"
                                >
                                    💬 Telegram {COMPANY.telegramHandle}
                                </a>
                            </li>
                            <li>
                                <a
                                    href={COMPANY.siteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-white transition-colors flex items-center gap-1.5"
                                >
                                    🌐 {COMPANY.siteDomain}
                                </a>
                            </li>
                        </ul>

                        {/* Платёжные системы */}
                        <div className="mt-4">
                            <p className="text-xs text-imperial-muted mb-2">Оплата принимается через:</p>
                            <div className="flex gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs font-medium">
                                    ЮКасса
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium">
                                    Яндекс Пэй
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-500/10 border border-slate-500/20 text-slate-300 text-xs font-medium">
                                    Счёт (б/н)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Разделитель */}
                <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

                    {/* Копирайт и реквизиты */}
                    <div className="text-xs text-imperial-muted space-y-0.5">
                        <p>
                            © {since === year ? year : `${since}–${year}`} {COMPANY.shortName}. Все права защищены.
                        </p>
                        <p>
                            Адрес: {COMPANY.postalAddress}
                        </p>
                        <p>
                            Генеральный директор: {COMPANY.director}
                        </p>
                    </div>

                    {/* Настройки Cookie */}
                    <button
                        type="button"
                        onClick={openCookieConsentSettings}
                        className="text-xs text-imperial-muted hover:text-white transition-colors underline underline-offset-2"
                    >
                        🍪 Настройки cookie
                    </button>
                </div>

            </div>
        </footer>
    );
}
