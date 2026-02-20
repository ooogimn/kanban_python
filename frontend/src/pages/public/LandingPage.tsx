import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { blogApi } from '../../api/blog';

// Изображения лендинга: положите файлы в frontend/public/landing/ (имена: hero.jpg, mission.jpg, philosophy.jpg, visualization.jpg, time.jpg, office.jpg, analytics.jpg, ai.jpg, tech.jpg, early-access.jpg)
const heroImage = '/landing/hero.jpg';
const philosophyImage = '/landing/philosophy.jpg';
const visualizationImage = '/landing/visualization.jpg';
const timeImage = '/landing/time.jpg';
const officeImage = '/landing/office.jpg';
const analyticsImage = '/landing/analytics.jpg';
const aiImage = '/landing/ai.jpg';
const techImage = '/landing/tech.jpg';
const earlyAccessImage = '/landing/early-access.jpg';

/** Видео в модалке (по клику «Войти в личный кабинет»): frontend/public/landing/demo-video.mp4 */
const LANDING_VIDEO_SRC = '/landing/demo-video.mp4';
/** Видео в модалке (по клику «Получить доступ»): frontend/public/landing/register-video.mp4 */
const LANDING_REGISTER_VIDEO_SRC = '/landing/register-video.mp4';
/** Видео на главном экране (сразу видно, автоплей со звуком): frontend/public/landing/hero-video.mp4 */
const LANDING_HERO_VIDEO_SRC = '/landing/hero-video.mp4';

/** Hero-видео: старт без звука (автоплей разрешён); через 3 с — подсказка «Включить звук»; по клику включаем звук 20% (клик = разрешённое действие браузера). */
function HeroVideoWithVolume() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = isMuted;
    el.volume = Math.max(0, Math.min(1, volume));
  }, [volume, isMuted]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const play = () => el.play().catch(() => {});
    el.play().catch(() => {});
    el.addEventListener('loadeddata', play);
    return () => el.removeEventListener('loadeddata', play);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowUnmutePrompt(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const enableSoundAt20 = () => {
    setIsMuted(false);
    setVolume(0.2);
    setShowUnmutePrompt(false);
  };

  const toggleMute = () => setIsMuted((m) => !m);
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v > 0) setIsMuted(false);
  };

  return (
    <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
      <div
        className="relative w-[700px] max-w-[90vw] h-[500px] max-h-[50vh] translate-x-0 lg:-translate-x-[200px] -translate-y-[30px] pointer-events-auto flex items-center justify-center"
      >
        <video
          ref={videoRef}
          src={LANDING_HERO_VIDEO_SRC}
          className="absolute inset-0 w-full h-full object-contain rounded-xl shadow-2xl"
          width={700}
          height={500}
          autoPlay
          loop
          playsInline
          muted={isMuted}
        />
        {showUnmutePrompt && isMuted && (
          <div className="absolute inset-0 rounded-xl bg-black/40 pointer-events-none" aria-hidden />
        )}
        {showUnmutePrompt && isMuted && (
          <button
            type="button"
            onClick={enableSoundAt20}
            className="absolute bottom-2 left-2 px-5 py-3 rounded-xl bg-cyan-500/90 text-slate-900 font-semibold hover:bg-cyan-400 transition-colors shadow-lg pointer-events-auto"
          >
            Включить звук (20%)
          </button>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-2 rounded-lg bg-black/60 backdrop-blur-sm px-2 py-1.5 border border-cyan-400/40">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1 rounded text-cyan-300 hover:bg-cyan-400/20 transition-colors"
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
            aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 accent-cyan-400 cursor-pointer"
            title="Громкость"
            aria-label="Громкость"
          />
        </div>
      </div>
    </div>
  );
}

const sections = [
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
  const [videoModalType, setVideoModalType] = useState<'login' | 'register' | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoModalType === null) return;
    const play = () => modalVideoRef.current?.play().catch(() => {});
    const t = setTimeout(play, 0);
    return () => clearTimeout(t);
  }, [videoModalType]);

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Hero — картинка во весь экран, текст и кнопки поверх */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-900">
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
          />
          <div
          className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/45"
            aria-hidden
          />
        <div className="absolute bottom-[6px] right-2 h-[12px] w-[120px] bg-green-900" aria-hidden />
          {/* Видео по центру: поверх фона, под кнопками; автоплей со звуком; своя кнопка громкости — всегда видна */}
          <HeroVideoWithVolume />
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
            {/* «Получить доступ» — выше по оси Y на 500px относительно блока ниже */}
            <div className="flex justify-center translate-y-[-280px] pointer-events-auto">
              <button
                type="button"
                onClick={() => setVideoModalType('register')}
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl border-2 border-cyan-400/60 text-cyan-300 text-xl font-semibold backdrop-blur-sm hover:bg-cyan-400/20 transition-colors sm:text-2xl"
                style={{ textShadow: '-12px 0 26px rgba(139,92,246,0.9), 12px 0 26px rgba(139,92,246,0.9), 0 0 14px rgba(139,92,246,0.8)' }}
              >
                Получить доступ
              </button>
            </div>
            {/* «Войти в личный кабинет» и подпись — на прежнем месте (translate-y-[250px]) */}
            <div className="flex flex-col items-center translate-y-[250px] pointer-events-auto">
              <div className="flex max-w-4xl flex-col items-center gap-6 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
                <button
                  type="button"
                  onClick={() => setVideoModalType('login')}
                  className="px-8 py-4 rounded-xl border-2 border-cyan-400/60 text-cyan-300 text-xl font-semibold backdrop-blur-sm hover:bg-cyan-400/20 transition-colors sm:text-2xl"
                  style={{ textShadow: '-12px 0 26px rgba(139,92,246,0.9), 12px 0 26px rgba(139,92,246,0.9), 0 0 14px rgba(139,92,246,0.8)' }}
                >
                  Войти в личный кабинет
                </button>
              </div>
              <p className="mt-8 text-xs uppercase tracking-[0.3em] text-cyan-200/60">
                PostgreSQL Core • Российский софт • Синхронизация в реальном времени
              </p>
            </div>
          </div>

          {/* Модальное окно с видео: «Войти в личный кабинет» — demo-video, «Получить доступ» — register-video */}
          {videoModalType !== null && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Видео"
            >
              <div className="relative w-full max-w-[700px] rounded-xl overflow-hidden bg-slate-900 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setVideoModalType(null)}
                  className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                  aria-label="Закрыть"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
                <video
                  ref={modalVideoRef}
                  src={videoModalType === 'register' ? LANDING_REGISTER_VIDEO_SRC : LANDING_VIDEO_SRC}
                  className="w-full aspect-video max-h-[500px] object-contain"
                  width={700}
                  height={500}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                />
                <div className="flex flex-wrap items-center justify-center gap-3 p-3 bg-slate-800/90">
                  <Link
                    to={videoModalType === 'register' ? '/register' : '/login'}
                    onClick={() => setVideoModalType(null)}
                    className="px-6 py-2 rounded-lg bg-cyan-500 text-slate-900 font-semibold hover:bg-cyan-400 transition-colors"
                  >
                    {videoModalType === 'register' ? 'Получить доступ' : 'Войти в личный кабинет'}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setVideoModalType(null)}
                    className="px-6 py-2 rounded-lg border border-slate-400 text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          )}
      </section>

      {/* Последние новости — вторая секция, 9 постов (3x3); фон mission.jpg */}
      <section
        className="relative py-16 px-4 border-t border-cyan-500/10 bg-contain bg-center bg-no-repeat bg-slate-900"
        style={{ backgroundImage: "url('/landing/mission.jpg')" }}
      >
        <div className="absolute inset-0 bg-slate-900/70" aria-hidden />
        <div className="relative z-10 max-w-6xl mx-auto">
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
          className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-900"
        >
          <img
            src={section.image}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
          />
          <div
            className={`absolute inset-0 ${index % 2 === 0
              ? 'bg-gradient-to-r from-black/60 via-black/35 to-transparent'
              : 'bg-gradient-to-l from-black/60 via-black/35 to-transparent'
              }`}
            aria-hidden
          />
          <div className="absolute bottom-[6px] right-2 h-[12px] w-[120px] bg-green-900" aria-hidden />
          {section.id === 'early' && (
            <div className="absolute left-0 right-0 top-1/2 z-10 flex justify-between items-center px-8 md:px-16 translate-y-[calc(-50%+255px)]">
              <button
                type="button"
                onClick={() => setVideoModalType('login')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-4 font-bold text-slate-900 shadow-[0_0_30px_rgba(255,213,0,0.45)] hover:scale-105 transition-transform"
              >
                Вход в личный кабинет
                <span aria-hidden>→</span>
              </button>
              <button
                type="button"
                onClick={() => setVideoModalType('register')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-4 font-bold text-slate-900 shadow-[0_0_30px_rgba(255,213,0,0.45)] hover:scale-105 transition-transform"
              >
                Получить доступ
                <span aria-hidden>→</span>
              </button>
            </div>
          )}
          <div
            className={`relative z-10 px-8 py-16 ${section.id === 'office' ? 'max-w-[21rem] translate-y-[-310px] translate-x-[20px]' : section.id === 'core' ? 'max-w-2xl translate-y-[-20px]' : 'max-w-2xl translate-y-[255px]'} ${index % 2 === 0 ? 'mr-auto ml-8 md:ml-16 text-left' : 'ml-auto mr-8 md:mr-16 text-left'
              }`}
          >
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-300 mb-3 opacity-100">{`0${index + 1}`}</p>
            {section.id !== 'time' && section.id !== 'office' && section.id !== 'analytics' && section.id !== 'ai-team' && section.id !== 'tech' && section.id !== 'visualization' && section.id !== 'early' && (
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
                className={`space-y-3 ${section.id === 'office' ? 'text-base' : 'text-lg'} ${section.id === 'office' ? 'text-cyan-300' : section.id === 'visualization' ? 'text-blue-300' : section.id === 'core' ? 'text-blue-300' : 'text-cyan-50/95'}`}
                style={section.id === 'office'
                  ? { textShadow: '-10px 0 24px rgba(34,211,238,0.7), 10px 0 24px rgba(34,211,238,0.7), 0 0 12px rgba(34,211,238,0.4)' }
                  : section.id === 'visualization'
                    ? { textShadow: '-10px 0 24px rgba(59,130,246,0.7), 10px 0 24px rgba(59,130,246,0.7), 0 0 12px rgba(59,130,246,0.5)' }
                    : section.id === 'core'
                      ? { textShadow: '-10px 0 24px rgba(59,130,246,0.8), 10px 0 24px rgba(59,130,246,0.8), 0 0 14px rgba(59,130,246,0.6)', marginTop: 275 }
                      : undefined}
              >
                {section.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${section.id === 'office' ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' : section.id === 'visualization' ? 'bg-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.8)]' : 'bg-amber-400 shadow-[0_0_12px_rgba(255,204,0,0.8)]'}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.cta && section.id !== 'early' && (
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
