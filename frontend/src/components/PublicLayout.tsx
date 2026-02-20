import { Outlet, Link } from 'react-router-dom';

/**
 * Публичный layout для лендинга и юр-страниц: хедер без сайдбара приложения.
 */
export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-imperial-bg text-imperial-text font-sans antialiased flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-imperial-surface/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2 text-white font-semibold">
            <img src="/OS_LOGO.png" alt="" className="w-8 h-8 rounded-lg object-contain bg-white/10" />
            <span>OS LukintrLab</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/blog" className="text-imperial-muted hover:text-white text-sm font-medium transition-colors">
              Блог
            </Link>
            <a href="/landing#pricing" className="text-imperial-muted hover:text-white text-sm font-medium transition-colors">
              Тарифы
            </a>
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
    </div>
  );
}
