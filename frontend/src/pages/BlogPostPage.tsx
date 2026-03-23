import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { blogApi } from '../api/blog';
import { SEOMeta } from '../components/SEOMeta';
import { JsonLd } from '../components/JsonLd';
import ImageLightbox from '../components/ImageLightbox';
import BlogAdInContent from '../components/BlogAdInContent';

/** URL медиа: при другом origin (например backend :8000) подменяем на текущий origin, чтобы запрос шёл через прокси. */
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

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const { data: post, isLoading, error } = useQuery({
    queryKey: ['blog', 'post', slug],
    queryFn: () => blogApi.getPostBySlug(slug!),
    enabled: !!slug,
  });

  if (!slug) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-imperial-muted">Не указана статья.</p>
        <Link to="/blog" className="text-imperial-gold hover:underline mt-4 inline-block">← К списку статей</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-imperial-muted">Загрузка…</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <SEOMeta title="Статья не найдена" description="Такой статьи не существует." noindex />
        <p className="text-amber-400">Статья не найдена.</p>
        <Link to="/blog" className="text-imperial-gold hover:underline mt-4 inline-block">← К списку статей</Link>
      </div>
    );
  }

  const dateStr = post.published_at
    ? format(new Date(post.published_at), 'd MMMM yyyy', { locale: ru })
    : '';
  const isHtmlContent = typeof post.content === 'string' && (post.content.trim().startsWith('<') || post.content.includes('</'));

  /** Разбивает контент на две части для вставки рекламы по середине. */
  const getContentParts = (): [string, string] => {
    const raw = post.content || '';
    if (raw.length < 400) return [raw, ''];
    const mid = Math.floor(raw.length * 0.45);
    if (isHtmlContent) {
      const afterP = raw.lastIndexOf('</p>', mid);
      if (afterP !== -1) return [raw.slice(0, afterP + 4), raw.slice(afterP + 4)];
      const afterDiv = raw.lastIndexOf('</div>', mid);
      if (afterDiv !== -1) return [raw.slice(0, afterDiv + 6), raw.slice(afterDiv + 6)];
    } else {
      const paras = raw.split(/\n\n+/);
      const half = Math.max(1, Math.floor(paras.length / 2));
      return [paras.slice(0, half).join('\n\n'), paras.slice(half).join('\n\n')];
    }
    return [raw.slice(0, mid), raw.slice(mid)];
  };
  const [contentPart1, contentPart2] = getContentParts();
  const hasMidAd = contentPart2.length > 0;

  // Базовый URL для schema, если mediaUrl вернул абсолютный путь, то используем его, иначе относительный преобразуем к абсолютному
  const imgUrlStr = mediaUrl(post.image_url) ?? "";

  const metaTitle = post.meta_title?.trim() || post.title;
  const metaDescription = post.meta_description?.trim() || post.excerpt || post.title;
  const canonicalUrl = post.canonical_url?.trim() || `/blog/${post.slug}`;
  const customOgImage = post.og_image?.trim();
  const absImgUrl = customOgImage || (imgUrlStr.startsWith('http') ? imgUrlStr : (typeof window !== 'undefined' && imgUrlStr ? `${window.location.origin}${imgUrlStr}` : imgUrlStr));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": metaTitle,
    "description": metaDescription,
    "image": absImgUrl || "https://antexpress.ru/og-image.jpg",
    "datePublished": post.published_at,
    "author": {
      "@type": "Organization",
      "name": "AntExpress",
      "url": "https://antexpress.ru"
    }
  };

  return (
    <article className="max-w-3xl mx-auto px-4 py-10">
      <SEOMeta
        title={metaTitle}
        description={metaDescription}
        url={canonicalUrl}
        image={customOgImage || imgUrlStr || undefined}
        type="article"
      />
      <JsonLd data={jsonLd} />

      <Link to="/blog" className="text-imperial-gold hover:underline text-sm mb-6 inline-block">← К списку статей</Link>

      {/* Главное медиа: видео или картинка */}
      {(() => {
        const videoSrc = mediaUrl(post.video_url);
        const imageSrc = mediaUrl(post.image_url);
        return (
          <>
            {videoSrc && (
              <div className="w-full rounded-2xl overflow-hidden mb-6 bg-black">
                <video
                  src={videoSrc}
                  controls
                  autoPlay={post.main_media_autoplay ?? true}
                  muted={post.main_media_autoplay ?? true}
                  playsInline
                  preload="metadata"
                  className="w-full max-h-96 object-contain"
                >
                  Ваш браузер не поддерживает видео.
                </video>
              </div>
            )}
            {!videoSrc && imageSrc && (
              <button
                type="button"
                onClick={() => setLightboxImage(imageSrc)}
                className="block w-full rounded-2xl overflow-hidden mb-6 max-h-80 focus:outline-none focus:ring-2 focus:ring-imperial-gold ring-offset-2 ring-offset-imperial-bg"
              >
                <img
                  src={imageSrc}
                  alt=""
                  className="w-full h-full object-cover cursor-zoom-in"
                />
              </button>
            )}
          </>
        );
      })()}

      <h1 className="text-3xl font-bold text-white mb-2">{post.title}</h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-imperial-muted text-sm mb-8">
        {dateStr && <span>{dateStr}</span>}
        <span title="Просмотры">👁 {post.views_count ?? 0}</span>
      </div>

      {isHtmlContent ? (
        <>
          <div
            className="prose prose-invert prose-slate max-w-none dark:prose-invert [&_img]:max-w-full [&_img]:cursor-zoom-in [&_video]:max-w-full"
            dangerouslySetInnerHTML={{ __html: contentPart1 }}
            onClick={(e) => {
              const target = (e.target as HTMLElement).closest('img');
              if (target?.src) setLightboxImage(target.src);
            }}
            role="article"
          />
          {hasMidAd && <BlogAdInContent />}
          {contentPart2 && (
            <div
              className="prose prose-invert prose-slate max-w-none dark:prose-invert [&_img]:max-w-full [&_img]:cursor-zoom-in [&_video]:max-w-full"
              dangerouslySetInnerHTML={{ __html: contentPart2 }}
              onClick={(e) => {
                const target = (e.target as HTMLElement).closest('img');
                if (target?.src) setLightboxImage(target.src);
              }}
              role="article"
            />
          )}
        </>
      ) : (
        <>
          <div className="prose prose-invert prose-slate max-w-none dark:prose-invert">
            <ReactMarkdown>{contentPart1}</ReactMarkdown>
          </div>
          {hasMidAd && <BlogAdInContent />}
          {contentPart2 && (
            <div className="prose prose-invert prose-slate max-w-none dark:prose-invert">
              <ReactMarkdown>{contentPart2}</ReactMarkdown>
            </div>
          )}
        </>
      )}

      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          alt={post.title}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </article>
  );
}
