import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useSidebarStore } from '../store/sidebarStore';
import { useThemeStore, applyThemeToDom } from '../store/themeStore';

const publicNavItems = [
  { name: 'Блог', href: '/blog', icon: '📰' },
  { name: 'Войти', href: '/login', icon: '🔐' },
  { name: 'Регистрация', href: '/register', icon: '✨' },
];

/**
 * Публичный layout для блога без авторизации: тот же сайдбар (стиль, кнопка «Свернуть»), минимум пунктов меню.
 */
export default function BlogLayout() {
  const { collapsed, toggle } = useSidebarStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    applyThemeToDom(isDark);
  }, [isDark]);

  const isActive = (href: string) => location.pathname === href || (href !== '/blog' && location.pathname.startsWith(href));

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-imperial-bg dark:text-imperial-text font-sans antialiased">
      <div
        role="button"
        tabIndex={0}
        aria-label="Закрыть меню"
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setMobileMenuOpen(false)}
      />
      <aside
        className={`fixed md:relative inset-y-0 left-0 bg-imperial-surface/80 backdrop-blur-xl border-r border-white/10 text-imperial-muted flex flex-col z-50 shrink-0 transition-all duration-300 ease-out shadow-2xl
          ${collapsed ? 'w-20' : 'w-[15.3rem]'}
          md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4 pb-2 flex flex-col min-h-0 flex-1">
          <Link
            to="/landing"
            className={`flex items-center gap-3 mb-6 ${collapsed ? 'justify-center' : ''}`}
          >
            <img src="/OS_LOGO.png" alt="OS LukintrLab" className="w-10 h-10 rounded-xl object-contain shrink-0 bg-white/10" />
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-bold text-white tracking-tight leading-none text-lg">OS LukintrLab</h1>
                <span className="text-[10px] uppercase tracking-widest text-imperial-gold font-semibold">Блог</span>
              </div>
            )}
          </Link>

          <nav className="space-y-0.5 flex-1">
            {publicNavItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 rounded-xl transition-all font-medium text-xs group ${collapsed ? 'w-full justify-center px-0 py-0.5' : 'w-[70%] px-4 py-0.5'
                  } ${isActive(item.href)
                    ? 'bg-white/5 text-white border-l-2 border-imperial-gold -ml-[2px] pl-4 text-imperial-gold shadow-[0_0_20px_rgba(139,92,246,0.45),0_0_40px_rgba(139,92,246,0.25)]'
                    : 'text-imperial-muted hover:bg-white/5 hover:text-white hover:shadow-[0_0_16px_rgba(139,92,246,0.3)]'
                  }`}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            ))}
          </nav>

          <div className={`border-t border-slate-700/50 pt-4 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
            <button
              type="button"
              onClick={toggle}
              className={`mt-3 flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors ${collapsed ? 'w-full py-2' : 'w-full px-4 py-2'}`}
              title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              <span className="text-lg">{collapsed ? '▶' : '◀'}</span>
              {!collapsed && <span className="text-sm">Свернуть</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white/90 dark:bg-imperial-surface/90 backdrop-blur-md border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 z-10 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Блог</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              aria-label={isDark ? 'Светлая тема' : 'Тёмная тема'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <Link to="/login" className="text-sm font-medium text-imperial-muted hover:text-white transition-colors">
              Войти
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-400 transition-colors text-sm"
            >
              Регистрация
            </Link>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative flex flex-col bg-slate-900">
          <div
            className="absolute inset-0 min-h-full bg-cover bg-center bg-no-repeat bg-slate-800"
            style={{ backgroundImage: "url('/landing/early-access.jpg')" }}
            aria-hidden
          />
          <div className="absolute inset-0 min-h-full bg-slate-900/70 dark:bg-slate-900/75" aria-hidden />
          <div className="relative z-10 flex-1 flex flex-col min-h-0 p-4 sm:p-6 lg:p-10">
            <Outlet />
            <footer className="mt-auto pt-6 pb-2 border-t border-white/10 text-center text-xs text-imperial-muted flex flex-wrap items-center justify-center gap-3">
            <Link to="/terms" className="hover:text-imperial-gold transition-colors">Пользовательское соглашение</Link>
            <Link to="/privacy" className="hover:text-imperial-gold transition-colors">Политика конфиденциальности</Link>
            <Link to="/offer" className="hover:text-imperial-gold transition-colors">Оферта</Link>
            <Link to="/legal/contacts" className="hover:text-imperial-gold transition-colors">Контакты</Link>
          </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
