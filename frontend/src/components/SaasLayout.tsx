/**
 * Layout для SaaS Admin — визуально отличается (красный/тёмный хедер).
 */
import { Outlet, Link, useLocation } from 'react-router-dom';

const nav = [
  { name: 'Дашборд', href: '/saas-admin' },
  { name: 'Планы', href: '/saas-admin/plans' },
  { name: 'Пользователи', href: '/saas-admin/users' },
  { name: 'Блог', href: '/saas-admin/blog' },
  { name: 'Реклама', href: '/saas-admin/ads' },
  { name: 'Админка', href: getDjangoAdminUrl(), external: true },
];

function getDjangoAdminUrl(): string {
  const env = import.meta.env.VITE_ADMIN_URL;
  if (env && typeof env === 'string') return env.trim().replace(/\/+$/, '') + '/';
  const apiUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (apiUrl) {
    try {
      const u = new URL(apiUrl);
      return `${u.origin}/admin/`;
    } catch {
      return '/admin/';
    }
  }
  return '/admin/';
}

export default function SaasLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-red-900/50 bg-red-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/saas-admin" className="flex items-center gap-2 font-bold text-red-200">
              <span className="text-xl" aria-hidden>⚙</span>
              <span>SaaS Admin</span>
            </Link>
            <nav className="flex gap-1">
              {nav.map((item) => {
                const isActive = !('external' in item && item.external) && (location.pathname === item.href || (item.href !== '/saas-admin' && location.pathname.startsWith(item.href)));
                const baseClass = `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-red-900/50 text-white' : 'text-red-200/80 hover:bg-red-900/30 hover:text-white'}`;
                if ('external' in item && item.external) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={baseClass}
                    >
                      {item.name}
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={baseClass}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <Link
            to="/dashboard"
            className="text-sm text-red-200/80 hover:text-white"
          >
            ← В приложение
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
