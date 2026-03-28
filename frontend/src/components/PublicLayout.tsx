import { Outlet, Link, useLocation } from 'react-router-dom';
import PublicFooter from './PublicFooter';
import BrandWordmark from './BrandWordmark';
import PublicIntegrationsHead from './PublicIntegrationsHead';
import LandingNavigatorWidget from './LandingNavigatorWidget';
import LandingAiAssistantWidget from './LandingAiAssistantWidget';

/**
 * Публичный layout для лендинга и юр-страниц: хедер без сайдбара приложения + полный футер.
 */
export default function PublicLayout() {
  const location = useLocation();
  const showLandingNavigator =
    location.pathname === '/landing' ||
    location.pathname === '/landing/' ||
    location.pathname === '/landing1' ||
    location.pathname === '/landing2';

  return (
    <div className="min-h-screen bg-imperial-bg text-imperial-text font-sans antialiased flex flex-col">
      <PublicIntegrationsHead />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-imperial-surface/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2 text-white font-semibold">
            <img src="/OS_LOGO.png?v=20260320" alt="" className="w-24 h-24 rounded-lg object-contain bg-white/10" />
            <BrandWordmark className="text-3xl font-bold leading-none" />
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <Link to="/blog" className="text-imperial-muted hover:text-white text-sm font-medium transition-colors">
              Блог
            </Link>
            <a href="/landing#pricing" className="text-imperial-muted hover:text-white text-sm font-medium transition-colors">
              Тарифы
            </a>
            <Link to="/legal/contacts" className="text-imperial-muted hover:text-white text-sm font-medium transition-colors">
              Контакты
            </Link>
            <Link to="/login" className="text-imperial-muted hover:text-white text-sm font-medium transition-colors">
              Войти
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 transition-colors text-sm"
            >
              Начать бесплатно
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
      {showLandingNavigator && <LandingNavigatorWidget />}
      {showLandingNavigator && <LandingAiAssistantWidget />}
    </div>
  );
}
