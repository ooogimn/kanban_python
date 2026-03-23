import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { blogApi } from '../../api/blog';
import { marketingApi } from '../../api/marketing';
import { SEOMeta } from '../../components/SEOMeta';
import { JsonLd } from '../../components/JsonLd';

const HERO_VIDEO = '/landing/hero-video.mp4?v=2';

type LandingMediaItem = {
  id?: string;
  category: string;
  title?: string;
  description?: string;
  media_type: 'image' | 'video';
  media_url: string;
};

const DEFAULT_CATEGORIES = [
  'Канбан доска',
  'Майндмап карты',
  'Финансовый блок',
  'Функционал ИИ',
  'Проектная работа',
  'Файловая система',
  'Система записей',
  'Управление бизнесом',
];

const DEFAULT_MEDIA: LandingMediaItem[] = [
  { category: 'Канбан доска', title: 'Поток задач по этапам', media_type: 'image', media_url: '/landing/hero.jpg' },
  { category: 'Майндмап карты', title: 'Визуализация связей', media_type: 'image', media_url: '/landing/visualization.jpg' },
  { category: 'Финансовый блок', title: 'Контроль денег и KPI', media_type: 'image', media_url: '/landing/analytics.jpg' },
  { category: 'Функционал ИИ', title: 'AI-сценарии и помощники', media_type: 'image', media_url: '/landing/ai.jpg' },
  { category: 'Проектная работа', title: 'Совместная работа отделов', media_type: 'video', media_url: '/landing/demo-video.mp4?v=2' },
  { category: 'Файловая система', title: 'Структура файлов и доступов', media_type: 'image', media_url: '/landing/office.jpg' },
  { category: 'Система записей', title: 'Блокноты и база знаний', media_type: 'image', media_url: '/landing/philosophy.jpg' },
  { category: 'Управление бизнесом', title: 'Стратегия и планирование', media_type: 'video', media_url: '/landing/hero-video.mp4?v=2' },
];

const portalCards = [
  { name: 'IdealImage.ru', desc: 'Мода, стиль и бьюти с AI', href: 'https://idealimage.ru', image: '/landing/ai.jpg' },
  { name: 'AntExpress.ru', desc: 'Управление проектами и командой', href: 'https://antexpress.ru', image: '/landing/hero.jpg' },
  { name: 'DrevoRodni.ru', desc: 'Генеалогия и семейная летопись', href: 'https://drevorodni.ru', image: '/landing/philosophy.jpg' },
  { name: 'Зарабатывай и учись', desc: 'Контент и обучение с монетизацией', href: '#', image: '/landing/tech.jpg' },
  { name: 'NLPers', desc: 'Развитие навыков и мышления', href: '#', image: '/landing/visualization.jpg' },
  { name: 'VasilisaLuck', desc: 'Авторский lifestyle-портал', href: '#', image: '/landing/office.jpg' },
  { name: 'Лаборатория Лукьянова', desc: 'Инженерные и ИТ-продукты', href: '#', image: '/landing/analytics.jpg' },
  { name: 'Leader Mode', desc: 'Системы роста и лидерства', href: '#', image: '/landing/time.jpg' },
];
type PortalCard = { name: string; desc: string; href: string; image: string };

type PrivateReview = { author: string; text: string; avatar?: string };
type CompanyReview = { company: string; text: string; logo: string };

const privateReviews: PrivateReview[] = [
  {
    author: 'Анна, фриланс-дизайнер',
    text: 'Для личной работы бесплатного тарифа хватает с головой: задачи, канбан-доски и заметки в одном месте.',
  },
  {
    author: 'Илья, проджект-менеджер',
    text: 'Перешли на Pro — получили прозрачный контроль сроков и AI-помощника для рутины.',
  },
];

const companyReviews: CompanyReview[] = [
  {
    company: 'СтройПроект Групп',
    logo: '/logo-ANT.jpg',
    text: 'Собрали отдел в одном пространстве, добавили бюджетирование и аналитические отчеты.',
  },
  {
    company: 'LukInterLab',
    logo: '/OS_LOGO.png?v=20260320',
    text: 'На Enterprise настроили процессы под нас: HR, финансы, проекты и единая система контроля.',
  },
];

function truncateReview(text: string, max = 100): string {
  const value = (text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
}

function formatPlanPrice(price: string | number, currency: string): string {
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) return `${price} ${currency}`;
  if (numeric === 0) return `0 ${currency}`;
  return `${numeric.toLocaleString('ru-RU')} ${currency}`;
}

function extractPlanFeatures(limits: Record<string, unknown>): string[] {
  const features: string[] = [];
  const maxUsers = Number(limits.max_users ?? 0);
  const maxProjects = Number(limits.max_projects ?? 0);
  const maxAi = Number(limits.max_ai_agents ?? 0);
  const storage = Number(limits.storage_gb ?? 0);
  const description = typeof limits.description === 'string' ? limits.description.trim() : '';

  features.push(maxUsers > 0 ? `до ${maxUsers} пользователей` : 'пользователи без лимита');
  features.push(maxProjects > 0 ? `до ${maxProjects} проектов` : 'проекты без лимита');
  if (maxAi > 0) features.push(`до ${maxAi} AI-агентов`);
  if (storage > 0) features.push(`хранилище ${storage} ГБ`);
  if (description) features.push(description);
  return features.slice(0, 4);
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '').replace('#', '');
  const valid = clean.length === 3 || clean.length === 6;
  if (!valid) return `rgba(100,116,139,${alpha})`;
  const full = clean.length === 3 ? clean.split('').map((x) => x + x).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mediaUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    // Оставляем абсолютные URL как есть (в т.ч. api.antexpress.ru/media/...),
    // иначе можно случайно сломать воспроизведение при другом nginx-роутинге.
    if (url.startsWith('http://') || url.startsWith('https://')) return new URL(url).toString();
    return url;
  } catch {
    return url;
  }
}

function BlogNineGrid() {
  const { data: posts } = useQuery({
    queryKey: ['landing2', 'blog', 'posts'],
    queryFn: () => blogApi.getPosts(),
  });

  const list = Array.isArray(posts) ? posts.slice(0, 9) : [];
  if (!list.length) {
    return <p className="text-sm text-slate-400">Скоро здесь появятся статьи блога.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {list.map((post) => {
        const dateStr = post.published_at
          ? format(new Date(post.published_at), 'd MMM yyyy', { locale: ru })
          : '';
        const videoSrc = mediaUrl(post.video_url);
        const imageSrc = mediaUrl(post.image_url);

        return (
          <Link
            key={post.id}
            to={`/blog/${post.slug}`}
            className="rounded-xl border border-indigo-300/35 bg-slate-900/75 overflow-hidden shadow-[0_0_18px_rgba(99,102,241,0.2)] hover:border-cyan-300/70 hover:shadow-[0_0_34px_rgba(34,211,238,0.32)] transition-all duration-300"
          >
            {videoSrc ? (
              <div className="w-full h-44 bg-black overflow-hidden">
                <video
                  src={videoSrc}
                  muted
                  loop
                  playsInline
                  autoPlay
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : imageSrc ? (
              <img
                src={imageSrc}
                alt={post.title}
                className="w-full h-44 object-cover"
                loading="lazy"
              />
            ) : null}
            <div className="p-4">
              <h3 className="text-white font-semibold line-clamp-2 mb-2">{post.title}</h3>
              {post.excerpt && <p className="text-slate-400 text-sm line-clamp-2 mb-2">{post.excerpt}</p>}
              <p className="text-xs text-cyan-300">{dateStr}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function TrainingCarousel() {
  const { data: publicSettings } = useQuery({
    queryKey: ['landing2', 'public-settings'],
    queryFn: () => marketingApi.getPublicSettings(),
  });

  const serverDefaultCategory = publicSettings?.default_landing_category || '';

  const categories = useMemo(() => {
    const server = Array.isArray(publicSettings?.landing_media_categories)
      ? publicSettings?.landing_media_categories.filter((x) => typeof x === 'string' && x.trim())
      : [];
    return server.length ? server : DEFAULT_CATEGORIES;
  }, [publicSettings]);

  const mediaItems = useMemo(() => {
    const server = Array.isArray(publicSettings?.landing_media_carousel)
      ? publicSettings?.landing_media_carousel.filter((x) => x && typeof x === 'object')
      : [];
    const selected = server.length ? server : DEFAULT_MEDIA;
    return selected
      .map((item) => ({
        id: String(item.id || `${item.category}-${item.media_url}`),
        category: String(item.category || '').trim(),
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        media_type: item.media_type === 'video' ? 'video' as const : 'image' as const,
        media_url: mediaUrl(item.media_url) || '',
      }))
      .filter((item) => item.category && item.media_url);
  }, [publicSettings]);

  const categoriesWithContent = useMemo(() => {
    const set = new Set(mediaItems.map((i) => i.category));
    return categories.filter((c) => set.has(c));
  }, [categories, mediaItems]);

  const [activeCategory, setActiveCategory] = useState('');
  const [index, setIndex] = useState(0);
  const [videoInteractive, setVideoInteractive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [autoPaused, setAutoPaused] = useState(false);

  useEffect(() => {
    if (!categoriesWithContent.length) return;
    if (!categoriesWithContent.includes(activeCategory)) {
      const start = serverDefaultCategory && categoriesWithContent.includes(serverDefaultCategory)
        ? serverDefaultCategory
        : categoriesWithContent[0];
      setActiveCategory(start);
    }
  }, [categoriesWithContent, activeCategory, serverDefaultCategory]);

  const categoryItems = useMemo(
    () => mediaItems.filter((item) => item.category === activeCategory),
    [mediaItems, activeCategory],
  );

  useEffect(() => {
    setIndex(0);
    setVideoInteractive(false);
    setAutoPaused(false);
  }, [activeCategory]);

  useEffect(() => {
    setVideoInteractive(false);
    setAutoPaused(false);
  }, [index]);

  useEffect(() => {
    if (categoryItems.length <= 1 || autoPaused) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % categoryItems.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [categoryItems.length, autoPaused]);

  const handleVideoClick = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (!videoInteractive) {
      vid.muted = false;
      vid.controls = true;
      setVideoInteractive(true);
      setAutoPaused(true);
    }
  }, [videoInteractive]);

  if (!categoryItems.length) {
    return <p className="text-sm text-slate-400">Добавьте элементы учебной карусели в SaaS-панели.</p>;
  }

  const current = categoryItems[index] || categoryItems[0];
  const nextSlide = () => setIndex((prev) => (prev + 1) % categoryItems.length);
  const prevSlide = () => setIndex((prev) => (prev - 1 + categoryItems.length) % categoryItems.length);

  const activeCatIdx = categoriesWithContent.indexOf(activeCategory);
  const prevCategory = () => {
    const next = (activeCatIdx - 1 + categoriesWithContent.length) % categoriesWithContent.length;
    setActiveCategory(categoriesWithContent[next]);
  };
  const nextCategory = () => {
    const next = (activeCatIdx + 1) % categoriesWithContent.length;
    setActiveCategory(categoriesWithContent[next]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={prevCategory}
          className="shrink-0 w-9 h-9 rounded-full border border-white/20 bg-slate-800 text-white hover:bg-fuchsia-600/60 transition-colors flex items-center justify-center"
          aria-label="Предыдущая категория"
        >
          ‹
        </button>

        <div className="flex-1 overflow-x-auto no-scrollbar">
          <div className="inline-flex min-w-full gap-2 pb-1">
            {categoriesWithContent.map((category) => {
              const active = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`relative whitespace-nowrap rounded-full px-4 py-2 text-sm border transition-all ${
                    active
                      ? 'border-fuchsia-400/60 text-white'
                      : 'border-white/10 text-slate-300 hover:text-white hover:border-fuchsia-300/40'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="landing2-category-pill"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-fuchsia-600/60 to-cyan-500/60"
                    />
                  )}
                  <span className="relative z-10">{category}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={nextCategory}
          className="shrink-0 w-9 h-9 rounded-full border border-white/20 bg-slate-800 text-white hover:bg-fuchsia-600/60 transition-colors flex items-center justify-center"
          aria-label="Следующая категория"
        >
          ›
        </button>
      </div>

      <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-black">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id || `${current.category}-${index}`}
            initial={{ opacity: 0, x: 35, rotateY: 8 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            exit={{ opacity: 0, x: -35, rotateY: -8 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
            className="w-full aspect-[16/9]"
          >
            {current.media_type === 'video' ? (
              <div className="relative w-full h-full group cursor-pointer" onClick={handleVideoClick}>
                <video
                  ref={videoRef}
                  key={current.media_url}
                  src={current.media_url}
                  autoPlay
                  muted={!videoInteractive}
                  loop
                  playsInline
                  controls={videoInteractive}
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
                {!videoInteractive && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-2xl group-hover:scale-110 transition-transform">
                      🔊
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <img src={current.media_url} alt={current.title || current.category} className="w-full h-full object-cover" />
            )}
          </motion.div>
        </AnimatePresence>

        {!videoInteractive && (
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 to-transparent pointer-events-none">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{current.category}</p>
            {current.title && <h3 className="text-lg md:text-2xl font-semibold">{current.title}</h3>}
            {current.description && <p className="text-sm text-slate-200 mt-1">{current.description}</p>}
          </div>
        )}

        {categoryItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 border border-white/30 text-white hover:bg-black/90 transition-colors text-2xl font-black z-20"
              aria-label="Предыдущий слайд"
            >
              ←
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 border border-white/30 text-white hover:bg-black/90 transition-colors text-2xl font-black z-20"
              aria-label="Следующий слайд"
            >
              →
            </button>
          </>
        )}
      </div>

      {categoryItems.length > 1 && (
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevSlide}
              className="px-3 py-1.5 rounded-lg border border-white/25 bg-slate-900/70 text-white text-sm hover:bg-fuchsia-600/60 transition-colors"
              aria-label="Назад по материалам"
            >
              ← Назад
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="px-3 py-1.5 rounded-lg border border-white/25 bg-slate-900/70 text-white text-sm hover:bg-fuchsia-600/60 transition-colors"
              aria-label="Вперёд по материалам"
            >
              Вперёд →
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {categoryItems.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => setIndex(dotIdx)}
                className={`rounded-full transition-all ${
                  dotIdx === index
                    ? 'w-6 h-2.5 bg-fuchsia-400'
                    : 'w-2.5 h-2.5 bg-white/25 hover:bg-white/50'
                }`}
                aria-label={`Слайд ${dotIdx + 1}`}
              />
            ))}
          </div>
          <span className="text-sm text-slate-300">Слайд {index + 1} из {categoryItems.length}</span>
        </div>
      )}
    </div>
  );
}

function ReviewDrum({
  items,
  renderItem,
  direction = 'up',
}: {
  items: string[];
  renderItem: (id: string) => React.ReactNode;
  direction?: 'up' | 'down';
}) {
  const [index, setIndex] = useState(0);
  const safeItems = items.length ? items : [];

  useEffect(() => {
    if (safeItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % safeItems.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [safeItems.length]);

  if (!safeItems.length) {
    return <p className="text-sm text-slate-500">Отзывы скоро появятся.</p>;
  }

  const firstIdx = index % safeItems.length;
  const secondIdx = (index + 1) % safeItems.length;
  const ordered =
    safeItems.length === 1
      ? [firstIdx]
      : direction === 'up'
        ? [firstIdx, secondIdx]
        : [secondIdx, firstIdx];
  const prev = () => setIndex((prevIdx) => (prevIdx - 1 + safeItems.length) % safeItems.length);
  const next = () => setIndex((prevIdx) => (prevIdx + 1) % safeItems.length);
  const controlsDisabled = safeItems.length <= 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={prev}
          disabled={controlsDisabled}
          className={`w-8 h-8 rounded-lg border text-white transition-colors ${
            controlsDisabled
              ? 'border-white/10 bg-slate-800/40 opacity-50 cursor-not-allowed'
              : 'border-white/20 bg-slate-900/70 hover:bg-slate-700'
          }`}
          aria-label="Прокрутить вверх"
          title="Прокрутить вверх"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={next}
          disabled={controlsDisabled}
          className={`w-8 h-8 rounded-lg border text-white transition-colors ${
            controlsDisabled
              ? 'border-white/10 bg-slate-800/40 opacity-50 cursor-not-allowed'
              : 'border-white/20 bg-slate-900/70 hover:bg-slate-700'
          }`}
          aria-label="Прокрутить вниз"
          title="Прокрутить вниз"
        >
          ↓
        </button>
        <span className="text-xs text-slate-300 rounded-md border border-white/10 bg-slate-900/60 px-2 py-1">
          Отзывов: {safeItems.length}
        </span>
      </div>
      {ordered.map((idx) => (
        <motion.div
          key={`${safeItems[idx]}-${idx}-${index}`}
          initial={{ opacity: 0, y: direction === 'up' ? 24 : -24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          {renderItem(safeItems[idx])}
        </motion.div>
      ))}
    </div>
  );
}

export default function LandingPageV2() {
  const { data: publicSettings } = useQuery({
    queryKey: ['landing2', 'public-settings', 'reviews'],
    queryFn: () => marketingApi.getPublicSettings(),
  });

  const privateList = useMemo<PrivateReview[]>(
    () =>
      Array.isArray(publicSettings?.landing_private_reviews) && publicSettings.landing_private_reviews.length
        ? publicSettings.landing_private_reviews
        : privateReviews,
    [publicSettings],
  );
  const companyList = useMemo<CompanyReview[]>(
    () =>
      Array.isArray(publicSettings?.landing_company_reviews) && publicSettings.landing_company_reviews.length
        ? publicSettings.landing_company_reviews
        : companyReviews,
    [publicSettings],
  );
  const [selectedReview, setSelectedReview] = useState<{
    title: string;
    text: string;
    avatarOrLogo?: string;
    subtitle?: string;
  } | null>(null);
  const landingPlans = useMemo(
    () =>
      Array.isArray(publicSettings?.landing_plans)
        ? publicSettings.landing_plans
        : [],
    [publicSettings],
  );
  const landingPortalCards = useMemo<PortalCard[]>(
    () =>
      Array.isArray(publicSettings?.landing_portal_cards) && publicSettings.landing_portal_cards.length
        ? publicSettings.landing_portal_cards
            .map((c) => ({
              name: String(c.name || '').trim(),
              desc: String(c.desc || '').trim(),
              href: String(c.href || '').trim(),
              image: String(c.image || '').trim(),
            }))
            .filter((c) => c.name && c.href)
        : portalCards,
    [publicSettings],
  );
  const planStyles = useMemo(() => {
    const fromServer = Array.isArray(publicSettings?.landing_plan_styles)
      ? publicSettings.landing_plan_styles
      : [];
    const map = new Map<string, { border_color: string; glow_color: string }>();
    fromServer.forEach((s) => {
      const key = String(s.plan_name || '').trim();
      if (!key) return;
      map.set(key, {
        border_color: String(s.border_color || '#64748b'),
        glow_color: String(s.glow_color || '#38bdf8'),
      });
    });
    return map;
  }, [publicSettings]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AntExpress',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'AntExpress: единая платформа для задач, проектов, CRM, аналитики и совместной работы команды.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEOMeta
        title="AntExpress — задачи, проекты, CRM и аналитика в одном сервисе"
        description="Запустите работу команды в AntExpress: задачи, канбан, диаграмма Ганта, документы, блог и аналитика в единой системе."
        url="/landing"
      />
      <JsonLd data={jsonLd} />

      <section className="max-w-6xl mx-auto px-4 pt-16 pb-10">
        <p className="text-cyan-300 text-xs uppercase tracking-[0.2em] mb-3">Landing 2.0</p>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight">
          Управляйте проектами и командой в
          {' '}
          <span className="text-red-500">Ant</span>
          <span className="text-blue-400">Express</span>
        </h1>
        <p className="text-slate-300 text-lg mt-5 max-w-3xl">
          Единое рабочее пространство: задачи, канбан, Гант, документы, аналитика и AI-помощники.
          Быстрый старт за 10 минут, прозрачные тарифы, готово для роста компании.
        </p>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link to="/register" className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 font-semibold">
            Начать бесплатно
          </Link>
          <Link to="/login" className="px-6 py-3 rounded-xl border border-slate-500 hover:bg-slate-800 font-semibold">
            Войти в кабинет
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-14">
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
          <video
            src={HERO_VIDEO}
            autoPlay
            loop
            muted
            playsInline
            className="w-full aspect-video object-cover"
          />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-14 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Быстрый старт', text: 'Создайте рабочее пространство, пригласите команду и начните вести задачи за 10 минут.' },
          { title: 'Контроль сроков', text: 'Канбан + Гант + календарь в единой модели данных без дублирования.' },
          { title: 'Прозрачность роста', text: 'Отчеты и аналитика по задачам, нагрузке и эффективности команды.' },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-cyan-300/35 bg-slate-900/75 p-5 shadow-[0_0_18px_rgba(34,211,238,0.18)] hover:border-cyan-200/70 hover:shadow-[0_0_34px_rgba(34,211,238,0.32)] transition-all duration-300">
            <h2 className="font-semibold text-xl mb-2">{item.title}</h2>
            <p className="text-slate-300">{item.text}</p>
          </div>
        ))}
      </section>

      <section id="training-panel" className="max-w-6xl mx-auto px-4 pb-14 rounded-2xl border border-fuchsia-400/40 bg-slate-900/30 shadow-[0_0_42px_rgba(217,70,239,0.24)] hover:shadow-[0_0_58px_rgba(217,70,239,0.36)] hover:border-fuchsia-300/65 transition-all duration-300">
        <h2 className="text-3xl font-bold mb-2 text-center">Учебная и демонстрационная панель</h2>
        <p className="text-slate-300 mb-5 text-sm text-center">
          Категории можно менять в SaaS-панели. Внутри каждого раздела — изображения, инфографика и короткие видео в едином формате.
        </p>
        <TrainingCarousel />
      </section>

      <section id="pricing" className="max-w-6xl mx-auto px-4 pb-14 rounded-2xl border border-cyan-400/40 bg-slate-900/30 shadow-[0_0_42px_rgba(34,211,238,0.22)] hover:shadow-[0_0_58px_rgba(34,211,238,0.34)] hover:border-cyan-300/65 transition-all duration-300">
        <h2 className="text-3xl font-bold mb-5 text-center">Тарифы под ваш этап роста</h2>
        {landingPlans.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-4">
            {landingPlans.map((plan) => {
              const features = extractPlanFeatures(plan.limits || {});
              const styleCfg = planStyles.get(plan.name) || (plan.is_default
                ? { border_color: '#ef4444', glow_color: '#f43f5e' }
                : { border_color: '#67e8f9', glow_color: '#22d3ee' });
              return (
                <div
                  key={plan.id}
                  className="rounded-3xl p-5 w-full md:w-[340px] border-2"
                  style={{
                    borderColor: styleCfg.border_color,
                    background: hexToRgba(styleCfg.border_color, 0.14),
                    boxShadow: `0 0 28px ${hexToRgba(styleCfg.glow_color, 0.5)}, 0 0 64px ${hexToRgba(styleCfg.glow_color, 0.24)}`,
                  }}
                >
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="text-slate-300 mt-1">{plan.is_default ? 'Рекомендуемый план' : 'Тариф для вашего этапа роста'}</p>
                  <p className="text-3xl font-bold mt-4">{formatPlanPrice(plan.price, plan.currency)}</p>
                  <ul className="mt-4 text-sm text-slate-200 space-y-1">
                    {features.length ? (
                      features.map((f, idx) => <li key={`${plan.id}-f-${idx}`}>• {f}</li>)
                    ) : (
                      <li>• Гибкие лимиты и настройки</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-slate-300 text-sm">Тарифы обновляются из SaaS-панели. Данные скоро появятся.</p>
        )}
      </section>

      <section id="reviews" className="max-w-6xl mx-auto px-4 pb-14 rounded-2xl border border-amber-300/40 bg-slate-900/30 shadow-[0_0_42px_rgba(251,191,36,0.2)] hover:shadow-[0_0_58px_rgba(251,191,36,0.3)] hover:border-amber-200/65 transition-all duration-300">
        <h2 className="text-3xl font-bold mb-5 text-center">Дополнительные услуги и возможности</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-amber-300/35 bg-slate-900/75 p-5 shadow-[0_0_16px_rgba(251,191,36,0.16)] hover:border-amber-200/70 hover:shadow-[0_0_30px_rgba(251,191,36,0.28)] transition-all duration-300">
            <h3 className="font-semibold text-xl mb-2">Отдельные опции к тарифу</h3>
            <p className="text-slate-300 text-sm">
              Можно подключать отдельные услуги: desktop-версия, Telegram/MAX/Web + бот, интеграции с внешними
              сервисами, персональный AI-агент.
            </p>
          </div>
          <div className="rounded-xl border border-amber-300/35 bg-slate-900/75 p-5 shadow-[0_0_16px_rgba(251,191,36,0.16)] hover:border-amber-200/70 hover:shadow-[0_0_30px_rgba(251,191,36,0.28)] transition-all duration-300">
            <h3 className="font-semibold text-xl mb-2">Партнерская программа</h3>
            <p className="text-slate-300 text-sm">
              Приводите друзей и коллег — бонусы и подарки для вас и приглашенных. Отдельные условия для партнеров и интеграторов.
            </p>
          </div>
          <div className="rounded-xl border border-amber-300/35 bg-slate-900/75 p-5 shadow-[0_0_16px_rgba(251,191,36,0.16)] hover:border-amber-200/70 hover:shadow-[0_0_30px_rgba(251,191,36,0.28)] transition-all duration-300">
            <h3 className="font-semibold text-xl mb-2">Кастомизация под запрос</h3>
            <p className="text-slate-300 text-sm">
              За отдельный бюджет настраиваем систему под личные и корпоративные сценарии: процессы, роли, финпотоки, шаблоны, автоматизацию.
            </p>
          </div>
          <div className="rounded-xl border border-amber-300/35 bg-slate-900/75 p-5 shadow-[0_0_16px_rgba(251,191,36,0.16)] hover:border-amber-200/70 hover:shadow-[0_0_30px_rgba(251,191,36,0.28)] transition-all duration-300">
            <h3 className="font-semibold text-xl mb-2">Масштаб и франшиза</h3>
            <p className="text-slate-300 text-sm">
              На платформе можно построить полноценный бизнес-контур и подготовить его к тиражированию/франчайзингу.
            </p>
          </div>
        </div>
      </section>

      <section id="products-network" className="max-w-6xl mx-auto px-4 pb-14 rounded-2xl border border-pink-400/40 bg-slate-900/30 shadow-[0_0_44px_rgba(236,72,153,0.24)] hover:shadow-[0_0_62px_rgba(236,72,153,0.36)] hover:border-pink-300/70 transition-all duration-300">
        <h2 className="text-3xl font-bold mb-5 text-center">Отзывы пользователей и компаний</h2>
        <p className="text-slate-400 mb-4 text-sm">Частные и корпоративные отзывы. Новые отзывы отправляются на модерацию.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-pink-300/35 bg-slate-900/75 p-5 shadow-[0_0_18px_rgba(236,72,153,0.2)] hover:border-pink-200/70 hover:shadow-[0_0_34px_rgba(236,72,153,0.34)] transition-all duration-300">
            <h3 className="text-xl font-semibold mb-3">Частные пользователи</h3>
            <ReviewDrum
              items={privateList.map((_, idx) => `p-${idx}`)}
              direction="up"
              renderItem={(id) => {
                const i = Number(id.split('-')[1] || 0);
                const r = privateList[i];
                return (
                  <button
                    type="button"
                    className="w-full text-left rounded-3xl border-2 border-cyan-400/60 bg-slate-800/90 p-4 shadow-[0_0_34px_rgba(34,211,238,0.34),inset_0_0_28px_rgba(34,211,238,0.14)] hover:border-cyan-300 transition-colors"
                    onClick={() =>
                      setSelectedReview({
                        title: r.author,
                        subtitle: 'Частный отзыв',
                        text: r.text,
                        avatarOrLogo: r.avatar || '/OS_LOGO.png?v=20260320',
                      })
                    }
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <img src={r.avatar || '/OS_LOGO.png?v=20260320'} alt={r.author} className="w-11 h-11 rounded-full object-cover border border-white/20" />
                      <p className="text-cyan-300 text-sm">{r.author}</p>
                    </div>
                    <p className="text-slate-100 text-sm">“{truncateReview(r.text, 100)}”</p>
                  </button>
                );
              }}
            />
          </div>
          <div className="rounded-xl border border-pink-300/35 bg-slate-900/75 p-5 shadow-[0_0_18px_rgba(236,72,153,0.2)] hover:border-pink-200/70 hover:shadow-[0_0_34px_rgba(236,72,153,0.34)] transition-all duration-300">
            <h3 className="text-xl font-semibold mb-3">Компании</h3>
            <ReviewDrum
              items={companyList.map((_, idx) => `c-${idx}`)}
              direction="down"
              renderItem={(id) => {
                const i = Number(id.split('-')[1] || 0);
                const r = companyList[i];
                return (
                  <button
                    type="button"
                    className="w-full text-left rounded-3xl border-2 border-fuchsia-400/60 bg-slate-800/90 p-4 shadow-[0_0_34px_rgba(217,70,239,0.34),inset_0_0_28px_rgba(217,70,239,0.16)] hover:border-fuchsia-300 transition-colors"
                    onClick={() =>
                      setSelectedReview({
                        title: r.company,
                        subtitle: 'Отзыв компании',
                        text: r.text,
                        avatarOrLogo: r.logo || '/OS_LOGO.png?v=20260320',
                      })
                    }
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <img src={r.logo || '/OS_LOGO.png?v=20260320'} alt={r.company} className="w-11 h-11 rounded object-cover border border-white/20 bg-white/5" />
                      <p className="text-fuchsia-300 text-sm font-medium">{r.company}</p>
                    </div>
                    <p className="text-slate-200 text-sm">“{truncateReview(r.text, 100)}”</p>
                  </button>
                );
              }}
            />
          </div>
        </div>

      </section>

      <section id="blog-preview" className="max-w-6xl mx-auto px-4 pb-14 rounded-2xl border border-teal-300/40 bg-slate-900/30 shadow-[0_0_42px_rgba(45,212,191,0.22)] hover:shadow-[0_0_58px_rgba(45,212,191,0.34)] hover:border-teal-200/70 transition-all duration-300">
        <h2 className="text-3xl font-bold mb-5 text-center">Наша сеть порталов и продуктов</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {landingPortalCards.map((card) => (
            <a
              key={card.name}
              href={card.href}
              target={card.href === '#' ? undefined : '_blank'}
              rel={card.href === '#' ? undefined : 'noopener noreferrer'}
              className="rounded-xl border border-teal-300/35 overflow-hidden bg-slate-900/75 shadow-[0_0_16px_rgba(45,212,191,0.18)] hover:border-pink-300/70 hover:shadow-[0_0_32px_rgba(236,72,153,0.32)] transition-all duration-300"
            >
              <img src={card.image} alt={card.name} className="w-full h-36 object-cover" loading="lazy" />
              <div className="p-3">
                <h3 className="font-semibold text-white">{card.name}</h3>
                <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{card.desc}</p>
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-500 text-white text-sm font-semibold">
                    Перейти на сайт →
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-14 rounded-2xl border border-indigo-300/40 bg-slate-900/30 shadow-[0_0_40px_rgba(99,102,241,0.22)] hover:shadow-[0_0_56px_rgba(99,102,241,0.34)] hover:border-indigo-200/70 transition-all duration-300">
        <h2 className="text-3xl font-bold mb-5 text-center">Наш БЛОГ - Журнал известий</h2>
        <BlogNineGrid />
        <div className="mt-6">
          <Link to="/blog" className="text-cyan-300 hover:text-cyan-200 font-semibold">
            Перейти в блог →
          </Link>
        </div>
      </section>

      <section id="faq" className="max-w-6xl mx-auto px-4 pb-20 rounded-2xl border border-blue-300/40 bg-slate-900/30 shadow-[0_0_40px_rgba(59,130,246,0.22)] hover:shadow-[0_0_56px_rgba(59,130,246,0.34)] hover:border-blue-200/70 transition-all duration-300">
        <h2 className="text-3xl font-bold mb-5 text-center">FAQ</h2>
        <div className="space-y-3">
          {[
            ['Можно ли начать бесплатно?', 'Да, есть бесплатный тариф для старта.'],
            ['Есть ли доступ с телефона?', 'Да, интерфейс адаптивный, также можно работать через Telegram.'],
            ['Можно ли масштабировать под отдел?', 'Да, для команд и компаний есть Pro/Enterprise.'],
          ].map(([q, a]) => (
            <details key={q} className="rounded-xl border border-blue-300/35 bg-slate-900/75 p-4 shadow-[0_0_14px_rgba(59,130,246,0.16)] hover:border-blue-200/70 hover:shadow-[0_0_28px_rgba(59,130,246,0.3)] open:border-blue-200/80 open:shadow-[0_0_34px_rgba(59,130,246,0.36)] transition-all duration-300">
              <summary className="font-semibold cursor-pointer">{q}</summary>
              <p className="text-slate-300 mt-2">{a}</p>
            </details>
          ))}
        </div>
      </section>
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-600 bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                {selectedReview.avatarOrLogo && (
                  <img
                    src={selectedReview.avatarOrLogo}
                    alt={selectedReview.title}
                    className="w-11 h-11 rounded-full object-cover border border-white/20"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-white truncate">{selectedReview.title}</h3>
                  {selectedReview.subtitle && <p className="text-xs text-slate-400">{selectedReview.subtitle}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                className="w-8 h-8 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <p className="text-slate-200 text-sm leading-6 whitespace-pre-wrap">“{selectedReview.text}”</p>
          </div>
        </div>
      )}
    </div>
  );
}
