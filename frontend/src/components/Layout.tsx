import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ChevronsLeft } from 'lucide-react';
import PageTransition from './PageTransition';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useSidebarStore } from '../store/sidebarStore';
import { useRightDrawerStore } from '../store/rightDrawerStore';
import { useThemeStore, applyThemeToDom } from '../store/themeStore';
import { useDashboardWebSocket } from '../hooks/useWebSocket';
import { useUpgradeModalStore } from '../store/upgradeModalStore';
import { authApi } from '../api/auth';
import UpgradePlanModal from './UpgradePlanModal';
import AdSlot from './AdSlot';
import FooterAdGrid from './FooterAdGrid';
import AiChatWidget from './ai/AiChatWidget';
import GlobalChatDrawer from './GlobalChatDrawer';
import OnboardingWizard from './onboarding/OnboardingWizard';
import { LEGAL_LINKS } from '../constants/legalLinks';
import { openCookieConsentSettings } from '../lib/cookieConsent';
import { accountApi } from '../api/account';
import BrandWordmark from './BrandWordmark';

type NavItem = {
  name: string;
  href: string;
  icon: string;
  iconImage?: string;
  title?: string;
};

/** Personal — всегда доступны (Freemium) */
const personalNavItems: NavItem[] = [
  { name: 'Монитор', href: '/dashboard', icon: '📊' },
  { name: 'Задачи', href: '/tasks', icon: '✓' },
  { name: 'Канбан', href: '/kanban', icon: '📋' },
  { name: 'Гант', href: '/gantt', icon: '📈', title: 'Диаграмма Ганта' },
  { name: 'Календарь', href: '/calendar', icon: '📅' },
  { name: 'Документы', href: '/documents', icon: '📄', title: 'Личная вики: дерево записей и вложения' },
  { name: 'Блог', href: '/blog', icon: '📰' },
  { name: 'ИИ-агенты', href: '/ai/marketplace', icon: '✨', iconImage: '/CHAT_BOT_AI.png', title: 'Маркетплейс и чат с ИИ' },
  { name: 'Карта', href: '/mindmaps', icon: '🗺️', title: 'Карта' },
  { name: 'Кабинет', href: '/account', icon: '💳', title: 'Личный кабинет — подписка и тариф' },
];

/** Business (Premium) — при plan_type === 'personal' показываются неактивными (иконки без замка, клик → модалка) */
const businessNavItems: NavItem[] = [
  { name: 'Пространства', href: '/workspaces', icon: '🏢' },
  { name: 'Проекты', href: '/projects', icon: '📁' },
  { name: 'Контакты', href: '/contacts', icon: '👥', title: 'Управление людьми (HR)' },
  { name: 'Финансы', href: '/finance', icon: '💳', title: 'Дашборд и счета' },
  { name: 'Аналитика', href: '/analytics', icon: '📈', title: 'Аналитика и экспорт отчётов' },
  { name: 'люди vs ИИ', href: '/ai/team-comparison', icon: '⚖️', title: 'Продуктивность и затраты команды и ИИ' },
];

/** Пункты меню, видимые только Director/Manager (Business) */
const financeNavItems: NavItem[] = [
  { name: 'HR', href: '/hr', icon: '💰', title: 'Команда, отпуска и зарплата' },
];

function canSeeFinance(groups?: string[], isSuperuser?: boolean): boolean {
  if (isSuperuser) return true;
  if (!groups || !Array.isArray(groups)) return false;
  return groups.includes('Director') || groups.includes('Manager');
}

interface LayoutProps {
  /** При использовании Layout для маршрута /blog (авторизованный пользователь) — контент блога вместо Outlet */
  overrideContent?: React.ReactNode;
}

export default function Layout({ overrideContent }: LayoutProps = {}) {
  const { user } = useAuthStore();
  const { collapsed, toggle } = useSidebarStore();
  const rightPanelOpen = useRightDrawerStore((s) => s.open);
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
    enabled: !!user,
  });
  const avatarUrl = profile?.avatar ?? undefined;
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.username || 'Пользователь';
  const groups = profile?.groups ?? user?.groups ?? [];
  const showFinance = canSeeFinance(groups, profile?.is_superuser);
  const isDirectorOrOwner = (profile?.groups ?? []).includes('Director') || (profile?.groups ?? []).includes('Owner');
  const showOnboarding = !!profile && profile.is_onboarded === false && isDirectorOrOwner;
  const planType = profile?.plan_type ?? 'personal';
  const showAds = profile?.show_ads === true;
  const businessItems: NavItem[] = [
    ...businessNavItems,
    ...(showFinance ? financeNavItems : []),
  ];
  const openUpgradeModal = useUpgradeModalStore((s) => s.openModal);
  useDashboardWebSocket();

  // Загружаем данные текущей подписки для бейджика в хедере
  const { data: accountData } = useQuery({
    queryKey: ['my-account'],
    queryFn: accountApi.getAccount,
    retry: 1,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // кешируем 5 мин
  });
  // plan_badge — новое поле R1-S4 от Cursor AI (напр. 'PRO'), fallback на plan.name
  const currentPlanName = accountData?.plan_badge ?? accountData?.plan?.name ?? null;
  const isSuperuser = profile?.is_superuser === true;

  // Синхронизация темы с DOM при монтировании (на случай гонки с гидрацией persist)
  useEffect(() => {
    applyThemeToDom(isDark);
  }, [isDark]);

  const isActive = (href: string) => {
    if (href.includes('?')) {
      const [path, search] = href.split('?');
      return location.pathname === path && location.search.includes(search);
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-imperial-bg dark:text-imperial-text font-sans antialiased">
      {/* Мобильный оверлей */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Закрыть меню"
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setMobileMenuOpen(false)}
      />
      {/* Sidebar — glass effect (Cyber-Imperial), фиксирован слева */}
      <aside
        className={`relative fixed md:relative inset-y-0 left-0 bg-imperial-surface/80 backdrop-blur-xl border-r border-white/10 text-imperial-muted flex flex-col z-50 shrink-0 transition-all duration-300 ease-out shadow-2xl
          ${collapsed ? 'w-20' : 'w-[15.3rem]'}
          md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Кнопка-лепесток: сворачивание сайдбара */}
        <button
          type="button"
          onClick={toggle}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 h-12 w-6 bg-slate-900 rounded-r-full flex items-center justify-center cursor-pointer border-r border-y border-slate-700 z-50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <ChevronsLeft className="w-3.5 h-3.5 shrink-0" aria-hidden />
        </button>
        <div className="p-4 pb-2 flex flex-col min-h-0 flex-1">
          <Link
            to="/landing"
            className={`flex items-center gap-3 mb-6 ${collapsed ? 'justify-center' : ''}`}
          >
            <img src="/OS_LOGO.png?v=20260320" alt="AntExpress" className="w-10 h-10 rounded-xl object-contain shrink-0 bg-white/10" />
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-bold text-white tracking-tight leading-none text-lg">
                  <BrandWordmark />
                </h1>
                <span className="text-[10px] uppercase tracking-widest text-imperial-gold font-semibold">
                  Мониторинг и задачи
                </span>
              </div>
            )}
          </Link>

          <nav className="space-y-0.5 flex-1">
            {personalNavItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                title={collapsed ? (item.title || item.name) : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 rounded-xl transition-all font-medium text-xs group ${collapsed ? 'w-full justify-center px-0 py-0.5' : 'w-[70%] px-4 py-0.5'
                  } ${isActive(item.href)
                    ? 'bg-white/5 text-white border-l-2 border-imperial-gold -ml-[2px] pl-4 text-imperial-gold shadow-[0_0_20px_rgba(139,92,246,0.45),0_0_40px_rgba(139,92,246,0.25)]'
                    : 'text-imperial-muted hover:bg-white/5 hover:text-white hover:shadow-[0_0_16px_rgba(139,92,246,0.3)]'
                  }`}
              >
                {item.iconImage ? (
                  <img src={item.iconImage} alt="" className="w-5 h-5 object-contain shrink-0" aria-hidden />
                ) : (
                  <span className="text-base shrink-0">{item.icon}</span>
                )}
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            ))}
            {businessItems.map((item) => {
              const locked = planType === 'personal';
              const baseClass = `flex items-center gap-2 rounded-xl transition-all font-medium text-xs group ${collapsed ? 'w-full justify-center px-0 py-0.5' : 'w-[70%] px-4 py-0.5'} ${locked ? 'opacity-60 cursor-pointer' : ''} ${isActive(item.href)
                ? 'bg-white/5 text-white border-l-2 border-imperial-gold -ml-[2px] pl-4 text-imperial-gold shadow-[0_0_20px_rgba(139,92,246,0.45),0_0_40px_rgba(139,92,246,0.25)]'
                : 'text-imperial-muted hover:bg-white/5 hover:text-white hover:shadow-[0_0_16px_rgba(139,92,246,0.3)]'
                }`;
              if (locked) {
                return (
                  <button
                    key={item.name}
                    type="button"
                    title={collapsed ? (item.title || item.name) : 'Доступно в бизнес-тарифе'}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openUpgradeModal('FEATURE_LOCKED', 'Для доступа к этому разделу оплатите подписку.');
                    }}
                    className={baseClass}
                  >
                    {item.iconImage ? (
                      <img src={item.iconImage} alt="" className="w-5 h-5 object-contain shrink-0" aria-hidden />
                    ) : (
                      <span className="text-base shrink-0">{item.icon}</span>
                    )}
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </button>
                );
              }
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={collapsed ? (item.title || item.name) : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={baseClass}
                >
                  {item.iconImage ? (
                    <img src={item.iconImage} alt="" className="w-5 h-5 object-contain shrink-0" aria-hidden />
                  ) : (
                    <span className="text-base shrink-0">{item.icon}</span>
                  )}
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {showAds && (
            <div className={`py-3 w-full overflow-hidden ${collapsed ? 'flex justify-center' : ''}`}>
              <AdSlot />
            </div>
          )}

          <div className="border-t border-slate-700/50 pt-4" />
        </div>
      </aside>

      {/* Main — отступ справа под лепесток (всегда) и под панель чата (когда открыта) */}
      <main
        className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-[margin] duration-300 ${collapsed ? 'ml-0' : 'ml-0'} ${rightPanelOpen ? 'md:mr-[252px]' : 'md:mr-6'}`}
      >
        <header className="h-16 lg:h-20 bg-white/90 dark:bg-imperial-surface/90 backdrop-blur-md border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 lg:px-10 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg lg:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">
              {getGreeting()}, {displayName}
            </h2>
            <span className="hidden sm:inline-flex px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Панель управления
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-600 hidden sm:block" />
            {isSuperuser && (
              <Link
                to="/saas-admin"
                className="text-sm font-medium text-red-400 hover:text-red-300 hidden sm:inline"
                title="Панель супер-админа"
              >
                SaaS Admin
              </Link>
            )}
            <Link
              to="/account"
              className="flex items-center gap-3 hover:opacity-90 transition-opacity"
              title="Личный кабинет — подписка и тариф"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">{displayName}</p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  {currentPlanName ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold uppercase tracking-wide border border-red-500/20">
                      {currentPlanName}
                    </span>
                  ) : (
                    <p className="text-[10px] text-slate-500">{user?.email}</p>
                  )}
                </div>
              </div>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl object-cover border-2 border-white dark:border-slate-700 shadow-sm shrink-0" />
              ) : (
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-slate-200 dark:bg-slate-600 border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold text-sm">
                  {displayName[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </Link>
          </div>
        </header>

        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-10 bg-slate-50 dark:bg-imperial-bg flex flex-col transition-[padding] duration-300 ${rightPanelOpen ? 'pr-[268px]' : 'pr-10 sm:pr-12 lg:pr-14'
            }`}
        >
          {overrideContent !== undefined ? (
            overrideContent
          ) : (
            <AnimatePresence mode="wait">
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          )}
          {planType === 'personal' && <FooterAdGrid />}
          <footer className="mt-auto pt-6 pb-2 border-t border-white/10 text-center text-xs text-imperial-muted flex flex-wrap items-center justify-center gap-3">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} to={link.href} className="hover:text-imperial-gold transition-colors">
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={openCookieConsentSettings}
              className="hover:text-imperial-gold transition-colors"
            >
              Настройки cookie
            </button>
          </footer>
        </div>
      </main>
      {showOnboarding && <OnboardingWizard onComplete={() => { }} />}
      <UpgradePlanModal />
      <AiChatWidget />
      <GlobalChatDrawer />
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
