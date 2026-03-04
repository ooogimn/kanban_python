import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
    { to: '/account', end: true, icon: '👤', label: 'Профиль и аккаунт' },
    { to: '/account/subscription', end: false, icon: '💳', label: 'Подписка' },
    { to: '/account/payments', end: false, icon: '💰', label: 'Платежи' },
    { to: '/account/upgrade', end: false, icon: '🚀', label: 'Сменить тариф' },
];

const activeClass =
    'bg-red-600/20 text-red-300 border-r-2 border-red-500';
const baseClass =
    'flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors rounded-l-lg';

export default function AccountLayout() {
    return (
        <div className="flex min-h-[calc(100vh-4rem)]">
            {/* Боковая навигация */}
            <aside className="w-56 shrink-0 border-r border-white/10 pt-6 pr-0 pl-2">
                <p className="px-4 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    Личный кабинет
                </p>
                <nav className="flex flex-col gap-0.5">
                    {NAV_ITEMS.map(({ to, end, icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                `${baseClass} ${isActive ? activeClass : ''}`
                            }
                        >
                            <span className="text-base leading-none">{icon}</span>
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* Основная область */}
            <main className="flex-1 overflow-y-auto px-6 py-6">
                <Outlet />
            </main>
        </div>
    );
}
