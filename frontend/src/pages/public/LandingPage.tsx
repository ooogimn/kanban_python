import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { blogApi } from '../../api/blog';

import heroImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0008.jpg';
import missionImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0001.jpg';
import philosophyImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0002.jpg';
import visualizationImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0003.jpg';
import timeImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0004.jpg';
import officeImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0005.jpg';
import analyticsImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0006.jpg';
import aiImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0007.jpg';
import techImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0009.jpg';
import earlyAccessImage from '../../../../INFO_PROJECT/ilovepdf_pages-to-jpg (1)/LukintreLab_OS_The_Digital_Nervous_System_page-0010.jpg';

const sections = [
  {
    id: 'mission',
    title: 'OS-LukintreLab: Выведем к успеху!',
    bullets: [
      'Собственные ИИ-процессы для управления проектами, HR и финансами',
      'Единая панель управления для директора, менеджера и ИИ-штата',
    ],
    image: missionImage,
  },
  {
    id: 'core',
    title: 'Философия Единого Ядра: Всё есть Задача',
    bullets: [
      'Один источник правды (WorkItem) — множество проекций',
      'Канбан, Гант и Календарь — разные взгляды на одни и те же данные',
    ],
    image: philosophyImage,
  },
  {
    id: 'visualization',
    title: 'Полная свобода визуализации',
    bullets: [
      'Кастомизация: цвета колонок под ваш стиль',
      'Статусы: автоматическое изменение цвета задачи',
      'Управление: Drag & Drop с мгновенным откликом (WebSockets)',
    ],
    image: visualizationImage,
  },
  {
    id: 'time',
    title: 'Управляйте временем, а не просто задачами',
    bullets: [],
    image: timeImage,
  },
  {
    id: 'office',
    title: 'Офис там, где вы',
    bullets: [
      'Telegram Mini App: вход и работа прямо из мессенджера',
      'Offline-First: работайте без интернета — синхронизация произойдёт автоматически',
      'Desktop Client (Tauri): максимум производительности',
    ],
    image: officeImage,
  },
  {
    id: 'analytics',
    title: 'Мощная аналитика без границ',
    bullets: [],
    image: analyticsImage,
  },
  {
    id: 'ai-team',
    title: 'Ваши новые AI-сотрудники',
    bullets: [],
    image: aiImage,
  },
  {
    id: 'tech',
    title: 'Технологический фундамент',
    bullets: [],
    image: techImage,
  },
  {
    id: 'early',
    title: 'OS-LukintreLab',
    cta: { label: 'Получить доступ', href: '/register' },
    image: earlyAccessImage,
  },
];

const FOOTER_LINKS = [
  { label: 'Блог', href: '/blog' },
  { label: 'Пользовательское соглашение', href: '/terms' },
  { label: 'Политика конфиденциальности', href: '/privacy' },
  { label: 'Политика обработки ПДн', href: '/personal-data' },
  { label: 'Публичная оферта', href: '/offer' },
  { label: 'Контакты', href: '/legal/contacts' },
];

/** URL медиа: при другом origin подменяем на текущий. */
function mediaUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url);
      if (typeof window !== 'undefined' && u.origin !== window.location.origin) {
        return window.location.origin + u.pathname + u.search;
      }
    }
    return url;
  } catch {
    return url;
  }
}

function LatestBlogPosts() {
  const { data: posts } = useQuery({
    queryKey: ['blog', 'posts'],
    queryFn: () => blogApi.getPosts(),
  });
  const list = Array.isArray(posts) ? posts : [];
  const latest = list.slice(0, 9);
  if (latest.length === 0) return null;
  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {latest.map((post) => {
        const dateStr = post.published_at
          ? format(new Date(post.published_at), 'd MMM yyyy', { locale: ru })
          : '';
        const videoSrc = mediaUrl(post.video_url);
        const imageSrc = mediaUrl(post.image_url);
        return (
          <Link
            key={post.id}
            to={`/blog/${post.slug}`}
            className="block rounded-xl border border-white/10 bg-slate-800/60 hover:bg-slate-800/80 overflow-hidden transition-colors"
          >
            {videoSrc ? (
              <div className="w-full h-40 bg-black overflow-hidden">
                <video
                  src={videoSrc}
                  muted
                  loop
                  playsInline
                  autoPlay
                  preload="metadata"
                  controls
                  className="w-full h-full object-cover"
                />
              </div>
            ) : imageSrc ? (
              <img src={imageSrc} alt="" className="w-full h-40 object-cover" />
            ) : null}
            <div className="p-4">
              <h3 className="font-bold text-white line-clamp-2 mb-1">{post.title}</h3>
              {post.excerpt && (
                <p className="text-sm text-slate-400 line-clamp-2 mb-2">{post.excerpt}</p>
              )}
              <p className="text-xs text-amber-400">{dateStr}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Hero — картинка во весь экран, текст и кнопки поверх */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
          className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/45"
            aria-hidden
          />
        <div className="absolute bottom-[6px] right-2 h-[12px] w-[120px] bg-green-900" aria-hidden />
          <div className="absolute top-[400px] left-[254px] z-10 max-w-4xl px-6 text-center">
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/register"
                className="absolute left-[229px] top-[253px] w-[460px] h-[50px] rounded-xl bg-transparent text-transparent font-bold hover:scale-105 transition-transform"
              >
                Получить доступ
              </Link>
            <Link
              to="/login"
              className="relative -top-[50px] left-[50px] px-8 py-4 rounded-xl border-2 border-cyan-400/60 text-cyan-300 text-2xl font-semibold backdrop-blur-sm hover:bg-cyan-400/20 transition-colors"
              style={{ textShadow: '-12px 0 26px rgba(139,92,246,0.9), 12px 0 26px rgba(139,92,246,0.9), 0 0 14px rgba(139,92,246,0.8)' }}
            >
              Войти в личный кабинет
            </Link>
          </div>
          <p className="relative top-[230px] mt-12 text-xs uppercase tracking-[0.3em] text-cyan-200/60">
            PostgreSQL Core • Российский софт • Синхронизация в реальном времени
          </p>
        </div>
      </section>

      {/* Последние новости — вторая секция, 9 постов (3x3) */}
      <section className="relative py-16 px-4 bg-slate-900/90 border-t border-cyan-500/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Последние новости</h2>
          <LatestBlogPosts />
          <div className="text-center mt-8">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 rounded-xl bg-imperial-gold px-6 py-3 font-bold text-slate-900 hover:bg-amber-400 transition-colors"
            >
              Читать блог
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Секции — картинка во всю секцию, текст и кнопки поверх */}
      {sections.map((section, index) => (
        <section
          key={section.id}
          className="relative min-h-screen flex items-center justify-center overflow-hidden"
        >
          <img
            src={section.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className={`absolute inset-0 ${index % 2 === 0
              ? 'bg-gradient-to-r from-black/60 via-black/35 to-transparent'
              : 'bg-gradient-to-l from-black/60 via-black/35 to-transparent'
              }`}
            aria-hidden
          />
          <div className="absolute bottom-[6px] right-2 h-[12px] w-[120px] bg-green-900" aria-hidden />
          <div
            className={`relative z-10 max-w-2xl px-8 py-16 ${index % 2 === 0 ? 'mr-auto ml-8 md:ml-16 text-left' : 'ml-auto mr-8 md:mr-16 text-left'
              }`}
          >
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-300 mb-3">{`0${index + 1}`}</p>
            {section.id !== 'time' && section.id !== 'office' && section.id !== 'analytics' && section.id !== 'ai-team' && section.id !== 'tech' && section.id !== 'visualization' && section.id !== 'mission' && (
              <h2
                className={`font-bold mb-4 ${section.id === 'core'
                  ? 'relative -top-[80px] text-base md:text-lg text-green-300'
                  : 'text-2xl md:text-4xl text-white drop-shadow-[0_0_20px_rgba(0,247,255,0.5)]'
                  }`}
                style={section.id === 'core'
                  ? { textShadow: '-12px 0 26px rgba(139,92,246,0.9), 12px 0 26px rgba(139,92,246,0.9), 0 0 16px rgba(139,92,246,0.85)' }
                  : undefined}
              >
                {section.title}
              </h2>
            )}
            {section.subtitle && (
              <p className="text-lg md:text-xl text-cyan-100/90 mb-6">{section.subtitle}</p>
            )}
            {section.bullets && (
              <ul
                className={`space-y-3 text-base ${section.id === 'office' ? 'text-cyan-300' : section.id === 'visualization' ? 'text-blue-300' : section.id === 'mission' ? 'text-green-300' : section.id === 'core' ? 'text-blue-300' : 'text-cyan-50/95'}`}
                style={section.id === 'office'
                  ? { textShadow: '-10px 0 24px rgba(34,211,238,0.7), 10px 0 24px rgba(34,211,238,0.7), 0 0 12px rgba(34,211,238,0.4)' }
                  : section.id === 'visualization'
                    ? { textShadow: '-10px 0 24px rgba(59,130,246,0.7), 10px 0 24px rgba(59,130,246,0.7), 0 0 12px rgba(59,130,246,0.5)' }
                    : section.id === 'mission'
                      ? { textShadow: '-10px 0 24px rgba(139,92,246,0.7), 10px 0 24px rgba(139,92,246,0.7), 0 0 12px rgba(139,92,246,0.5)', marginTop: -350 }
                      : section.id === 'core'
                        ? { textShadow: '-10px 0 24px rgba(59,130,246,0.8), 10px 0 24px rgba(59,130,246,0.8), 0 0 14px rgba(59,130,246,0.6)', marginTop: 275 }
                        : undefined}
              >
                {section.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${section.id === 'office' ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' : section.id === 'visualization' ? 'bg-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.8)]' : section.id === 'mission' ? 'bg-green-400 shadow-[0_0_12px_rgba(139,92,246,0.8)]' : 'bg-amber-400 shadow-[0_0_12px_rgba(255,204,0,0.8)]'}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.cta && (
              <div className="mt-8">
                <Link
                  to={section.cta.href}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-4 font-bold text-slate-900 shadow-[0_0_30px_rgba(255,213,0,0.45)] hover:scale-105 transition-transform"
                >
                  {section.cta.label}
                  <span aria-hidden>→</span>
                </Link>
                {section.cta.note && (
                  <p className="text-sm uppercase tracking-[0.2em] text-cyan-200 mt-4">{section.cta.note}</p>
                )}
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Footer */}
      <footer className="relative py-12 px-4 bg-black/80 backdrop-blur-sm border-t border-cyan-500/10">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-6 text-sm text-cyan-100/70">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} to={link.href} className="hover:text-amber-300 transition-colors">
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
      </div>
    </>
  );
}
