import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { blogApi, BlogPostListItem, type BlogCategory, type BlogTag } from '../api/blog';
import { Search } from 'lucide-react';

/** URL медиа: при другом origin подменяем на текущий, чтобы запрос шёл через прокси. */
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

function PostCard({ post }: { post: BlogPostListItem }) {
  const dateStr = post.published_at
    ? format(new Date(post.published_at), 'd MMMM yyyy', { locale: ru })
    : '';
  const videoSrc = mediaUrl(post.video_url);
  const imageSrc = mediaUrl(post.image_url);

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="block rounded-2xl border border-white/10 bg-imperial-surface/60 hover:bg-imperial-surface/80 overflow-hidden transition-colors"
    >
      {videoSrc ? (
        <div className="w-full h-48 bg-black overflow-hidden">
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
        <img
          src={imageSrc}
          alt=""
          className="w-full h-48 object-cover"
        />
      ) : null}
      <div className="p-5">
        <h2 className="text-lg font-bold text-white mb-2 line-clamp-2">{post.title}</h2>
        {post.excerpt && (
          <p className="text-sm text-imperial-muted line-clamp-2 mb-3">{post.excerpt}</p>
        )}
        <div className="flex items-center justify-between text-xs text-imperial-gold">
          <span>{dateStr}</span>
          <span className="text-imperial-muted" title="Просмотры">👁 {post.views_count ?? 0}</span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([]);

  const { data: categories = [] } = useQuery({
    queryKey: ['blog', 'categories'],
    queryFn: () => blogApi.getCategories(),
  });
  const { data: tags = [] } = useQuery({
    queryKey: ['blog', 'tags'],
    queryFn: () => blogApi.getTags(),
  });

  const params = {
    ...(search.trim() && { search: search.trim() }),
    ...(categorySlug && { category: categorySlug }),
    ...(selectedTagSlugs.length > 0 && { tags: selectedTagSlugs.join(',') }),
  };
  const {
    data: posts,
    isLoading,
    error,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['blog', 'posts', params],
    queryFn: () => blogApi.getPosts(params),
  });
  const list = Array.isArray(posts) ? posts : [];

  const err = isError && error ? (error as { response?: { data?: { detail?: string }; status?: number }; message?: string }) : null;
  const errorMessage = err
    ? (typeof err.response?.data?.detail === 'string' ? err.response.data.detail : null) ||
      (typeof (err as Error).message === 'string' ? (err as Error).message : '') ||
      'Не удалось загрузить статьи.'
    : '';

  const toggleTag = (slug: string) => {
    setSelectedTagSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-6">Блог</h1>

      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-white/10 bg-imperial-surface/60 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-imperial-gold"
            />
          </div>
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="px-4 py-2 rounded-lg border border-white/10 bg-imperial-surface/60 text-white focus:outline-none focus:ring-2 focus:ring-imperial-gold"
          >
            <option value="">Все категории</option>
            {(categories as BlogCategory[]).map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-slate-400 mr-1">Теги:</span>
            {(tags as BlogTag[]).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.slug)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedTagSlugs.includes(tag.slug)
                    ? 'bg-imperial-gold text-slate-900'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <p className="text-imperial-muted">Загрузка…</p>
      )}
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 text-amber-400">
          <p className="font-medium">Не удалось загрузить статьи.</p>
          {errorMessage && (
            <p className="mt-2 text-sm text-amber-300/90 break-words">{errorMessage}</p>
          )}
          <p className="mt-2 text-sm text-amber-200/80">
            Убедитесь, что бэкенд запущен и выполнены миграции:{' '}
            <code className="rounded bg-black/30 px-1">python manage.py migrate blog</code>
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="mt-3 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
          >
            {isRefetching ? 'Загрузка…' : 'Повторить'}
          </button>
        </div>
      )}
      {!isLoading && !error && list.length === 0 && (
        <p className="text-imperial-muted">Нет статей по заданным фильтрам.</p>
      )}
      {!isLoading && !error && list.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
