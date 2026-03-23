import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill';
import { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import QuillResizeImage from 'quill-resize-image';
import '../../components/documents/quillVideoAudio';
import { saasApi, type SaasBlogPost, type SaasBlogPostCreate, type SaasBlogCategory, type SaasBlogTag } from '../../api/saas';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Plus, LayoutGrid, List, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SEOMeta } from '../../components/SEOMeta';

Quill.register('modules/resize', QuillResizeImage);

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

const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link', 'image', 'video'],
  ['clean'],
];
const quillFormats = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'link', 'image', 'video'];

function PostModal({
  post,
  onClose,
  onSuccess,
}: {
  post: SaasBlogPost | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [isPublished, setIsPublished] = useState(post?.is_published ?? false);
  const [publishedAt, setPublishedAt] = useState(
    post?.published_at ? post.published_at.slice(0, 16) : ''
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // SEO fields
  const [metaTitle, setMetaTitle] = useState(post?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(post?.meta_description ?? '');
  const [canonicalUrl, setCanonicalUrl] = useState(post?.canonical_url ?? '');
  const [ogImage, setOgImage] = useState(post?.og_image ?? '');
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [metaTitleTouched, setMetaTitleTouched] = useState(Boolean(post?.meta_title?.trim()));
  const [metaDescriptionTouched, setMetaDescriptionTouched] = useState(Boolean(post?.meta_description?.trim()));
  const [canonicalUrlTouched, setCanonicalUrlTouched] = useState(Boolean(post?.canonical_url?.trim()));
  const [ogImageTouched, setOgImageTouched] = useState(Boolean(post?.og_image?.trim()));
  const [mainMediaAutoplay, setMainMediaAutoplay] = useState(post?.main_media_autoplay ?? true);
  const [categoryId, setCategoryId] = useState<number | ''>(post?.category ?? '');
  const [tagIds, setTagIds] = useState<number[]>(post?.tag_ids ?? []);
  const quillRef = useRef<ReactQuill>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const quillModules = useMemo(
    () => ({
      toolbar: {
        container: toolbarOptions,
        handlers: {
          image: () => imageInputRef.current?.click(),
          video: () => videoInputRef.current?.click(),
        },
      },
      resize: { modules: ['Resize', 'DisplaySize'] },
    }),
    []
  );

  const { data: categories = [] } = useQuery({
    queryKey: ['saas-blog-categories'],
    queryFn: () => saasApi.getBlogCategories(),
  });
  const { data: tags = [] } = useQuery({
    queryKey: ['saas-blog-tags'],
    queryFn: () => saasApi.getBlogTags(),
  });

  const toggleTag = (id: number) => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const insertImage = useCallback(async (file: File) => {
    try {
      const { url } = await saasApi.uploadBlogMedia(file);
      const q = quillRef.current?.getEditor();
      const range = q?.getSelection(true);
      if (q && range) {
        q.insertEmbed(range.index, 'image', url);
        q.setSelection(range.index + 1, 0);
      }
      toast.success('Изображение добавлено');
    } catch {
      toast.error('Ошибка загрузки изображения');
    }
  }, []);

  const insertVideo = useCallback(async (file: File) => {
    try {
      const { url } = await saasApi.uploadBlogMedia(file);
      const q = quillRef.current?.getEditor();
      const range = q?.getSelection(true);
      if (q && range) {
        q.insertEmbed(range.index, 'video', url);
        q.setSelection(range.index + 1, 0);
      }
      toast.success('Видео добавлено');
    } catch {
      toast.error('Ошибка загрузки видео');
    }
  }, []);

  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const stripHtml = (html: string): string => {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  useEffect(() => {
    if (!metaTitleTouched) {
      setMetaTitle(title.trim());
    }
  }, [title, metaTitleTouched]);

  useEffect(() => {
    if (metaDescriptionTouched) return;
    const source = excerpt.trim() || stripHtml(content);
    setMetaDescription(source.slice(0, 160));
  }, [excerpt, content, metaDescriptionTouched]);

  useEffect(() => {
    if (canonicalUrlTouched) return;
    const safeSlug = slugify(slug || title);
    if (!safeSlug) {
      setCanonicalUrl('');
      return;
    }
    setCanonicalUrl(`${window.location.origin}/blog/${safeSlug}`);
  }, [slug, title, canonicalUrlTouched]);

  useEffect(() => {
    if (ogImageTouched) return;
    setOgImage(post?.image_url ?? '');
  }, [post?.image_url, ogImageTouched]);

  const createMutation = useMutation({
    mutationFn: (data: FormData | SaasBlogPostCreate) => saasApi.createBlogPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-blog-posts'] });
      toast.success('Статья создана');
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData | Partial<SaasBlogPostCreate>) =>
      saasApi.updateBlogPost(post!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-blog-posts'] });
      toast.success('Статья обновлена');
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const getContentHtml = () => {
    const editor = quillRef.current?.getEditor?.();
    return editor?.root?.innerHTML ?? content;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Заполните заголовок');
      return;
    }
    if (post && !slug.trim()) {
      toast.error('Slug не может быть пустым при редактировании');
      return;
    }
    const contentToSave = getContentHtml();
    const catId = categoryId === '' ? null : Number(categoryId);
    if (imageFile || videoFile) {
      const fd = new FormData();
      fd.append('title', title.trim());
      if (post) fd.append('slug', slug.trim());
      fd.append('excerpt', excerpt);
      fd.append('content', contentToSave);
      fd.append('is_published', String(isPublished));
      fd.append('main_media_autoplay', String(mainMediaAutoplay));
      if (catId != null) fd.append('category', String(catId));
      fd.append('tag_ids', JSON.stringify(tagIds));
      if (publishedAt) fd.append('published_at', publishedAt);
      if (imageFile) fd.append('image', imageFile);
      if (videoFile) fd.append('video', videoFile);

      // SEO
      if (metaTitle.trim()) fd.append('meta_title', metaTitle.trim());
      if (metaDescription.trim()) fd.append('meta_description', metaDescription.trim());
      if (canonicalUrl.trim()) fd.append('canonical_url', canonicalUrl.trim());
      if (ogImage.trim()) fd.append('og_image', ogImage.trim());

      if (post) updateMutation.mutate(fd);
      else createMutation.mutate(fd);
    } else {
      const payload: SaasBlogPostCreate & { published_at?: string | null } = {
        title: title.trim(),
        excerpt,
        content: contentToSave,
        is_published: isPublished,
        published_at: publishedAt || null,
        main_media_autoplay: mainMediaAutoplay,
        category: catId ?? undefined,
        tag_ids: tagIds,
        meta_title: metaTitle.trim(),
        meta_description: metaDescription.trim(),
        canonical_url: canonicalUrl.trim(),
        og_image: ogImage.trim(),
      };
      if (post) (payload as { slug?: string }).slug = slug.trim();
      if (post) updateMutation.mutate(payload);
      else createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center sm:py-8">
      <div className="w-full max-w-2xl rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl max-h-[calc(100vh-2rem)] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          {post ? 'Редактировать статью' : 'Создать статью'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Заголовок *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
            />
          </div>
          {post ? (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Slug (URL)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
                placeholder="my-post"
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Slug будет сгенерирован автоматически из заголовка.</p>
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Краткое описание</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Категория</label>
            <select
              value={categoryId === '' ? '' : String(categoryId)}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
            >
              <option value="">— Без категории —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Теги</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700/80 text-slate-300 cursor-pointer hover:bg-slate-600/80"
                >
                  <input
                    type="checkbox"
                    checked={tagIds.includes(t.id)}
                    onChange={() => toggleTag(t.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{t.name}</span>
                </label>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-slate-500">Нет тегов. Создайте теги во вкладке «Категории и теги».</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Контент (текст, изображения, видео)</label>
            <div className="blog-quill-dark rounded-lg border border-slate-600 overflow-hidden bg-slate-700">
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={content}
                onChange={setContent}
                modules={quillModules}
                formats={quillFormats}
                className="bg-slate-700 text-white"
              />
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) insertImage(f);
                e.target.value = '';
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) insertVideo(f);
                e.target.value = '';
              }}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Главное медиа (картинка или видео в шапке поста)</label>
            <div className="space-y-2">
              <div>
                <span className="text-xs text-slate-500 mr-2">Изображение:</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setImageFile(e.target.files?.[0] ?? null);
                    if (e.target.files?.[0]) setVideoFile(null);
                  }}
                  className="text-slate-300 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-red-900/50 file:text-red-200 text-sm"
                />
                {post?.image_url && !imageFile && (
                  <p className="text-xs text-slate-500 mt-1">Текущее изображение загружено</p>
                )}
              </div>
              <div>
                <span className="text-xs text-slate-500 mr-2">Видео:</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    setVideoFile(e.target.files?.[0] ?? null);
                    if (e.target.files?.[0]) setImageFile(null);
                  }}
                  className="text-slate-300 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-red-900/50 file:text-red-200 text-sm"
                />
                {post?.video_url && !videoFile && (
                  <p className="text-xs text-slate-500 mt-1">Текущее видео загружено</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <input
                  type="checkbox"
                  checked={mainMediaAutoplay}
                  onChange={(e) => setMainMediaAutoplay(e.target.checked)}
                  className="rounded"
                />
                Автовоспроизведение главного видео
              </label>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={() => setIsSeoOpen((prev) => !prev)}
              className="w-full flex items-center justify-between rounded-lg px-2 py-2 text-left text-white hover:bg-slate-700/40"
            >
              <span className="text-lg font-bold">SEO Настройки</span>
              <ChevronDown
                className={`h-5 w-5 text-slate-400 transition-transform ${isSeoOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isSeoOpen && (
              <div className="space-y-4 mt-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Meta Title</label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => {
                      setMetaTitle(e.target.value);
                      setMetaTitleTouched(true);
                    }}
                    onBlur={() => {
                      if (!metaTitle.trim()) setMetaTitleTouched(false);
                    }}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
                    placeholder="Оптимизированный заголовок (по умолчанию берется из Заголовка)"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Meta Description</label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => {
                      setMetaDescription(e.target.value);
                      setMetaDescriptionTouched(true);
                    }}
                    onBlur={() => {
                      if (!metaDescription.trim()) setMetaDescriptionTouched(false);
                    }}
                    rows={2}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
                    placeholder="Краткое описание для поисковиков (по умолчанию берется из Краткого описания)"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Canonical URL</label>
                  <input
                    type="text"
                    value={canonicalUrl}
                    onChange={(e) => {
                      setCanonicalUrl(e.target.value);
                      setCanonicalUrlTouched(true);
                    }}
                    onBlur={() => {
                      if (!canonicalUrl.trim()) setCanonicalUrlTouched(false);
                    }}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
                    placeholder="https://example.com/original-article"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">OG:Image URL</label>
                  <input
                    type="text"
                    value={ogImage}
                    onChange={(e) => {
                      setOgImage(e.target.value);
                      setOgImageTouched(true);
                    }}
                    onBlur={() => {
                      if (!ogImage.trim()) setOgImageTouched(false);
                    }}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
                    placeholder="URL картинки для соцсетей (по умолчанию главное изображение)"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-700">
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded"
              />
              Опубликовано
            </label>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Дата публикации</label>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50"
            >
              {post ? 'Сохранить' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

type ViewMode = 'grid' | 'list';

function PostCard({
  post,
  onEdit,
  onDelete,
}: {
  post: SaasBlogPost;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dateStr = post.published_at
    ? format(new Date(post.published_at), 'd MMM yyyy', { locale: ru })
    : '';
  const videoSrc = mediaUrl(post.video_url);
  const imageSrc = mediaUrl(post.image_url);

  return (
    <div className="rounded-2xl border border-slate-600 bg-slate-800/80 overflow-hidden flex flex-col">
      {videoSrc ? (
        <div className="aspect-video bg-slate-700 overflow-hidden">
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
        <div className="aspect-video bg-slate-700 overflow-hidden">
          <img
            src={imageSrc}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-video bg-slate-700/50 flex items-center justify-center text-slate-500 text-sm">
          Нет медиа
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-bold text-white mb-1 line-clamp-2">{post.title}</h3>
        <p className="text-xs text-slate-500 mb-2">{post.slug}</p>
        {(post.category_name || (Array.isArray(post.tag_ids) && post.tag_ids.length > 0)) && (
          <p className="text-xs text-slate-500 mb-1">
            {post.category_name && <span className="text-slate-400">{post.category_name}</span>}
            {post.category_name && Array.isArray(post.tag_ids) && post.tag_ids.length > 0 && ' · '}
            {Array.isArray(post.tag_ids) && post.tag_ids.length > 0 && (
              <span>Теги: {post.tag_ids.length}</span>
            )}
          </p>
        )}
        <p className="text-xs text-slate-400 mb-3">
          {dateStr}
          {typeof post.views_count === 'number' && (
            <span className="ml-2 text-slate-500" title="Просмотры">👁 {post.views_count}</span>
          )}
        </p>
        <span
          className={`inline-flex w-fit px-2 py-0.5 rounded text-xs font-medium ${post.is_published ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-500'
            }`}
        >
          {post.is_published ? 'Опубликовано' : 'Черновик'}
        </span>
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-600">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 text-sm"
          >
            <Pencil className="w-3.5 h-3.5" />
            Редактировать
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-red-400 hover:border-red-900/50 text-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoriesAndTagsSection() {
  const queryClient = useQueryClient();
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catSortOrder, setCatSortOrder] = useState(0);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagSlug, setTagSlug] = useState('');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['saas-blog-categories'],
    queryFn: () => saasApi.getBlogCategories(),
  });
  const { data: tags = [] } = useQuery({
    queryKey: ['saas-blog-tags'],
    queryFn: () => saasApi.getBlogTags(),
  });

  const createCatMutation = useMutation({
    mutationFn: (data: { name: string; slug?: string; sort_order?: number }) =>
      saasApi.createBlogCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-blog-categories'] });
      toast.success('Категория создана');
      setCatName('');
      setCatSlug('');
      setCatSortOrder(0);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });
  const updateCatMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SaasBlogCategory> }) =>
      saasApi.updateBlogCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-blog-categories'] });
      toast.success('Категория обновлена');
      setEditingCategoryId(null);
      setCatName('');
      setCatSlug('');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });
  const deleteCatMutation = useMutation({
    mutationFn: (id: number) => saasApi.deleteBlogCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-blog-categories'] });
      toast.success('Категория удалена');
      setEditingCategoryId(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; slug?: string }) => saasApi.createBlogTag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-blog-tags'] });
      toast.success('Тег создан');
      setTagName('');
      setTagSlug('');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });
  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SaasBlogTag> }) =>
      saasApi.updateBlogTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-blog-tags'] });
      toast.success('Тег обновлён');
      setEditingTagId(null);
      setTagName('');
      setTagSlug('');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });
  const deleteTagMutation = useMutation({
    mutationFn: (id: number) => saasApi.deleteBlogTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-blog-tags'] });
      toast.success('Тег удалён');
      setEditingTagId(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const startEditCategory = (c: SaasBlogCategory) => {
    setEditingCategoryId(c.id);
    setCatName(c.name);
    setCatSlug(c.slug);
    setCatSortOrder(c.sort_order);
  };
  const startEditTag = (t: SaasBlogTag) => {
    setEditingTagId(t.id);
    setTagName(t.name);
    setTagSlug(t.slug);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Категории</h3>
        <div className="space-y-3 mb-4">
          <input
            type="text"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Название категории"
            className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={catSlug}
            onChange={(e) => setCatSlug(e.target.value)}
            placeholder="Slug (необязательно)"
            className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={catSortOrder}
            onChange={(e) => setCatSortOrder(Number(e.target.value) || 0)}
            placeholder="Порядок"
            className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            {editingCategoryId ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    updateCatMutation.mutate({
                      id: editingCategoryId,
                      data: { name: catName.trim(), slug: catSlug.trim() || undefined, sort_order: catSortOrder },
                    });
                  }}
                  disabled={updateCatMutation.isPending || !catName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-500 disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingCategoryId(null); setCatName(''); setCatSlug(''); setCatSortOrder(0); }}
                  className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-sm hover:bg-slate-700"
                >
                  Отмена
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  createCatMutation.mutate({
                    name: catName.trim(),
                    slug: catSlug.trim() || undefined,
                    sort_order: catSortOrder,
                  })
                }
                disabled={createCatMutation.isPending || !catName.trim()}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-50"
              >
                Добавить категорию
              </button>
            )}
          </div>
        </div>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2"
            >
              <span className="text-white text-sm">{c.name}</span>
              <span className="text-slate-500 text-xs">{c.slug}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => startEditCategory(c)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-600"
                  title="Редактировать"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => window.confirm('Удалить категорию?') && deleteCatMutation.mutate(c.id)}
                  className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-600"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="text-slate-500 text-sm">Нет категорий.</li>
          )}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Теги</h3>
        <div className="space-y-3 mb-4">
          <input
            type="text"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Название тега"
            className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={tagSlug}
            onChange={(e) => setTagSlug(e.target.value)}
            placeholder="Slug (необязательно)"
            className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            {editingTagId ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    updateTagMutation.mutate({
                      id: editingTagId,
                      data: { name: tagName.trim(), slug: tagSlug.trim() || undefined },
                    });
                  }}
                  disabled={updateTagMutation.isPending || !tagName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-500 disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingTagId(null); setTagName(''); setTagSlug(''); }}
                  className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-sm hover:bg-slate-700"
                >
                  Отмена
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  createTagMutation.mutate({ name: tagName.trim(), slug: tagSlug.trim() || undefined })
                }
                disabled={createTagMutation.isPending || !tagName.trim()}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-50"
              >
                Добавить тег
              </button>
            )}
          </div>
        </div>
        <ul className="space-y-2">
          {tags.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2"
            >
              <span className="text-white text-sm">{t.name}</span>
              <span className="text-slate-500 text-xs">{t.slug}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => startEditTag(t)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-600"
                  title="Редактировать"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => window.confirm('Удалить тег?') && deleteTagMutation.mutate(t.id)}
                  className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-600"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
          {tags.length === 0 && (
            <li className="text-slate-500 text-sm">Нет тегов.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default function SaasBlogPage() {
  const queryClient = useQueryClient();
  const [modalPost, setModalPost] = useState<SaasBlogPost | null | 'create'>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<'posts' | 'categories-tags'>('posts');

  const { data: posts = [], isLoading, error } = useQuery({
    queryKey: ['saas-blog-posts'],
    queryFn: () => saasApi.getBlogPosts(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => saasApi.deleteBlogPost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-blog-posts'] });
      toast.success('Статья удалена');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-300">
        Ошибка загрузки статей.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEOMeta
        title="Блог"
        description="Статьи, новости, кейсы и полезные материалы от команды AntExpress"
        url="/blog"
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Блог</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === 'posts' ? 'bg-red-900/50 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
          >
            Статьи
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories-tags')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === 'categories-tags' ? 'bg-red-900/50 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
          >
            Категории и теги
          </button>
          {activeTab === 'posts' && (
            <>
              <span className="text-sm text-slate-400">Вид:</span>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-red-900/50 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                title="Сетка"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-red-900/50 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                title="Список"
              >
                <List className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setModalPost('create')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500"
              >
                <Plus className="w-4 h-4" />
                Создать статью
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'categories-tags' ? (
        <CategoriesAndTagsSection />
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-8 text-center text-slate-400">
          Загрузка…
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onEdit={() => setModalPost(p)}
              onDelete={() => window.confirm('Удалить статью?') && deleteMutation.mutate(p.id)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-600 bg-slate-800/80">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                  Заголовок / Slug
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase">
                  Опубликовано
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                  Дата
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase">
                  Просмотры
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-slate-600/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <span className="font-medium text-white">{p.title}</span>
                    <span className="block text-sm text-slate-500">{p.slug}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={p.is_published ? 'text-green-400' : 'text-slate-500'}>
                      {p.is_published ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-sm">
                    {p.published_at
                      ? new Date(p.published_at).toLocaleString('ru-RU')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400 text-sm">
                    {typeof p.views_count === 'number' ? p.views_count : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setModalPost(p)}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-600"
                        title="Редактировать"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          window.confirm('Удалить статью?') && deleteMutation.mutate(p.id)
                        }
                        className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-600"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && (
            <div className="p-8 text-center text-slate-500">Нет статей. Создайте первую.</div>
          )}
        </div>
      )}
      {activeTab === 'posts' && viewMode === 'grid' && posts.length === 0 && (
        <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-8 text-center text-slate-500">
          Нет статей. Создайте первую.
        </div>
      )}

      {modalPost !== null && (
        <PostModal
          post={modalPost === 'create' ? null : modalPost}
          onClose={() => setModalPost(null)}
          onSuccess={() => { }}
        />
      )}
    </div>
  );
}
