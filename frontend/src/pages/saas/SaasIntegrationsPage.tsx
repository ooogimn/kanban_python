import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  saasApi,
  type LandingCarouselItem,
  type SaasPlatformSettings,
  type SaasPlatformSettingsUpdate,
} from '../../api/saas';

type FormState = {
  brand_name: string;
  public_site_url: string;
  yandex_webmaster_verification: string;
  yandex_metrika_counter_id: string;
  yandex_metrika_tag: string;
  google_analytics_measurement_id: string;
  google_tag_manager_id: string;
  yandex_rsy_site_id: string;
  yandex_rsy_block_id: string;
  yandex_rsy_script: string;
  custom_head_html: string;
  custom_body_html: string;
  yookassa_shop_id: string;
  yookassa_secret_key: string;
  yookassa_return_url: string;
};

const EMPTY_FORM: FormState = {
  brand_name: '',
  public_site_url: '',
  yandex_webmaster_verification: '',
  yandex_metrika_counter_id: '',
  yandex_metrika_tag: '',
  google_analytics_measurement_id: '',
  google_tag_manager_id: '',
  yandex_rsy_site_id: '',
  yandex_rsy_block_id: '',
  yandex_rsy_script: '',
  custom_head_html: '',
  custom_body_html: '',
  yookassa_shop_id: '',
  yookassa_secret_key: '',
  yookassa_return_url: '',
};

function isFilled(v: string | undefined | null): boolean {
  return Boolean((v || '').trim());
}

function shortText(value: string, max = 100): string {
  const text = (value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
}

function isValidHttpUrl(value: string): boolean {
  const src = (value || '').trim();
  if (!src) return false;
  try {
    const u = new URL(src, window.location.origin);
    if (src.startsWith('/')) return true;
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${
        ok
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-slate-600/20 text-slate-300 border-slate-500/40'
      }`}
    >
      <span aria-hidden>{ok ? '●' : '○'}</span>
      {label}
    </span>
  );
}

function Accordion({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-700/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {badge}
        </div>
        <span className={`text-slate-400 text-xl transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </section>
  );
}

function mapSettingsToForm(data: SaasPlatformSettings): FormState {
  return {
    brand_name: data.brand_name || '',
    public_site_url: data.public_site_url || '',
    yandex_webmaster_verification: data.yandex_webmaster_verification || '',
    yandex_metrika_counter_id: data.yandex_metrika_counter_id || '',
    yandex_metrika_tag: data.yandex_metrika_tag || '',
    google_analytics_measurement_id: data.google_analytics_measurement_id || '',
    google_tag_manager_id: data.google_tag_manager_id || '',
    yandex_rsy_site_id: data.yandex_rsy_site_id || '',
    yandex_rsy_block_id: data.yandex_rsy_block_id || '',
    yandex_rsy_script: data.yandex_rsy_script || '',
    custom_head_html: data.custom_head_html || '',
    custom_body_html: data.custom_body_html || '',
    yookassa_shop_id: data.yookassa_shop_id || '',
    yookassa_secret_key: '',
    yookassa_return_url: data.yookassa_return_url || '',
  };
}

export default function SaasIntegrationsPage() {
  const queryClient = useQueryClient();
  const [previewTs, setPreviewTs] = useState<number>(Date.now());
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hasSecret, setHasSecret] = useState(false);
  const [carouselCategories, setCarouselCategories] = useState<string[]>([]);
  const [carouselItems, setCarouselItems] = useState<LandingCarouselItem[]>([]);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [landingDefaultVersion, setLandingDefaultVersion] = useState<'v1' | 'v2'>('v2');
  const [portalCards, setPortalCards] = useState<Array<{ name: string; desc: string; href: string; image: string }>>([]);
  const [planStyles, setPlanStyles] = useState<Array<{ plan_name: string; border_color: string; glow_color: string }>>([]);
  const [privateReviews, setPrivateReviews] = useState<Array<{ author: string; text: string; avatar?: string }>>([]);
  const [companyReviews, setCompanyReviews] = useState<Array<{ company: string; text: string; logo: string }>>([]);
  const [aiCannedResponses, setAiCannedResponses] = useState<Array<{ keywords: string[]; answer: string }>>([]);
  const [aiFallbackReply, setAiFallbackReply] = useState('');
  const [aiChatLogs, setAiChatLogs] = useState<Array<{
    id: string;
    session_id: string;
    role: 'user' | 'assistant';
    message: string;
    created_at?: string;
    user_id?: number | null;
    user_username?: string;
  }>>([]);
  const [pendingReviews, setPendingReviews] = useState<Array<{
    id: string;
    review_type: 'private' | 'company';
    author?: string;
    company?: string;
    text: string;
    avatar_or_logo?: string;
    user_id?: number | null;
    user_username?: string;
    status?: string;
    created_at?: string;
  }>>([]);
  const [leadRequests, setLeadRequests] = useState<Array<{
    id: string;
    name: string;
    contact: string;
    message?: string;
    user_id?: number | null;
    user_username?: string;
    status?: string;
    source?: string;
    created_at?: string;
  }>>([]);
  const [newCategory, setNewCategory] = useState('');
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadingReviewKey, setUploadingReviewKey] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['saas-platform-settings'],
    queryFn: saasApi.getPlatformSettings,
  });
  const { data: saasPlans = [] } = useQuery({
    queryKey: ['saas-plans-style-editor'],
    queryFn: () => saasApi.getPlans(),
  });
  const { data: settingsHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ['saas-platform-settings-history'],
    queryFn: () => saasApi.getPlatformSettingsHistory(),
  });

  const hydrateCarousel = (src: SaasPlatformSettings) => {
    setCarouselCategories(
      Array.isArray(src.landing_media_categories)
        ? src.landing_media_categories.filter((x) => String(x || '').trim())
        : [],
    );
    setCarouselItems(
      Array.isArray(src.landing_media_carousel)
        ? src.landing_media_carousel
            .filter((item) => item && String(item.category || '').trim())
            .map((item) => ({
              id: item.id || crypto.randomUUID(),
              category: item.category,
              title: item.title || '',
              description: item.description || '',
              media_type: item.media_type === 'video' ? 'video' : 'image',
              media_url: item.media_url || '',
            }))
        : [],
    );
    setDefaultCategory(src.default_landing_category || '');
    setLandingDefaultVersion(src.landing_default_version === 'v1' ? 'v1' : 'v2');
    setPortalCards(
      Array.isArray(src.landing_portal_cards)
        ? src.landing_portal_cards.map((x) => ({
            name: String(x.name || ''),
            desc: String(x.desc || ''),
            href: String(x.href || ''),
            image: String(x.image || ''),
          }))
        : [],
    );
    setPlanStyles(
      Array.isArray(src.landing_plan_styles)
        ? src.landing_plan_styles
            .map((x) => ({
              plan_name: String(x.plan_name || '').trim(),
              border_color: String(x.border_color || '').trim() || '#64748b',
              glow_color: String(x.glow_color || '').trim() || '#38bdf8',
            }))
            .filter((x) => x.plan_name)
        : [],
    );
    setPrivateReviews(Array.isArray(src.landing_private_reviews) ? src.landing_private_reviews : []);
    setCompanyReviews(Array.isArray(src.landing_company_reviews) ? src.landing_company_reviews : []);
    setAiCannedResponses(
      Array.isArray(src.landing_ai_canned_responses)
        ? src.landing_ai_canned_responses
            .map((item) => ({
              keywords: Array.isArray(item?.keywords)
                ? item.keywords.map((k) => String(k || '').trim()).filter(Boolean)
                : [],
              answer: String(item?.answer || '').trim(),
            }))
            .filter((item) => item.answer)
        : [],
    );
    setAiFallbackReply(String(src.landing_ai_fallback_reply || '').trim());
    setAiChatLogs(
      Array.isArray(src.landing_ai_chat_logs)
        ? src.landing_ai_chat_logs
            .map((item) => ({
              id: String(item?.id || ''),
              session_id: String(item?.session_id || ''),
              role: (item?.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
              message: String(item?.message || ''),
              created_at: String(item?.created_at || ''),
              user_id: typeof item?.user_id === 'number' ? item.user_id : null,
              user_username: String(item?.user_username || ''),
            }))
            .filter((item) => item.id && item.session_id && item.message)
        : [],
    );
    setPendingReviews(Array.isArray(src.landing_pending_reviews) ? src.landing_pending_reviews : []);
    setLeadRequests(Array.isArray(src.landing_lead_requests) ? src.landing_lead_requests : []);
  };

  useEffect(() => {
    if (!data) return;
    setForm(mapSettingsToForm(data));
    setHasSecret(Boolean(data.has_yookassa_secret));
    hydrateCarousel(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: SaasPlatformSettingsUpdate) => saasApi.updatePlatformSettings(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['saas-platform-settings'], updated);
      setForm(mapSettingsToForm(updated));
      setHasSecret(Boolean(updated.has_yookassa_secret));
      hydrateCarousel(updated);
      void refetchHistory();
      toast.success('Настройки сохранены');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Не удалось сохранить';
      toast.error(msg);
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => saasApi.rollbackPlatformSettings(versionId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['saas-platform-settings'], updated);
      setForm(mapSettingsToForm(updated));
      setHasSecret(Boolean(updated.has_yookassa_secret));
      hydrateCarousel(updated);
      void refetchHistory();
      setPreviewTs(Date.now());
      toast.success('Откат версии выполнен');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Не удалось выполнить откат';
      toast.error(msg);
    },
  });

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const categories = carouselCategories.map((x) => x.trim()).filter(Boolean);
    const carousel = carouselItems
      .map((item) => ({
        ...item,
        category: item.category.trim(),
        title: (item.title || '').trim(),
        description: (item.description || '').trim(),
        media_url: item.media_url.trim(),
      }))
      .filter((item) => item.category && item.media_url);
    const payload: SaasPlatformSettingsUpdate = {
      brand_name: form.brand_name,
      public_site_url: form.public_site_url,
      yandex_webmaster_verification: form.yandex_webmaster_verification,
      yandex_metrika_counter_id: form.yandex_metrika_counter_id,
      yandex_metrika_tag: form.yandex_metrika_tag,
      google_analytics_measurement_id: form.google_analytics_measurement_id,
      google_tag_manager_id: form.google_tag_manager_id,
      yandex_rsy_site_id: form.yandex_rsy_site_id,
      yandex_rsy_block_id: form.yandex_rsy_block_id,
      yandex_rsy_script: form.yandex_rsy_script,
      custom_head_html: form.custom_head_html,
      custom_body_html: form.custom_body_html,
      landing_media_categories: categories,
      landing_media_carousel: carousel,
      landing_portal_cards: portalCards
        .map((c) => ({
          name: c.name.trim(),
          desc: c.desc.trim(),
          href: c.href.trim(),
          image: c.image.trim(),
        }))
        .filter((c) => c.name && c.href),
      landing_plan_styles: planStyles
        .map((s) => ({
          plan_name: s.plan_name.trim(),
          border_color: s.border_color || '#64748b',
          glow_color: s.glow_color || '#38bdf8',
        }))
        .filter((s) => s.plan_name),
      default_landing_category: defaultCategory,
      landing_default_version: landingDefaultVersion,
      landing_private_reviews: privateReviews,
      landing_company_reviews: companyReviews,
      landing_ai_canned_responses: aiCannedResponses
        .map((item) => ({
          keywords: (item.keywords || []).map((k) => String(k || '').trim()).filter(Boolean),
          answer: String(item.answer || '').trim(),
        }))
        .filter((item) => item.keywords.length > 0 && item.answer),
      landing_ai_fallback_reply: aiFallbackReply.trim(),
      landing_pending_reviews: pendingReviews,
      landing_lead_requests: leadRequests,
      yookassa_shop_id: form.yookassa_shop_id,
      yookassa_secret_key: form.yookassa_secret_key,
      yookassa_return_url: form.yookassa_return_url,
    };
    for (let i = 0; i < portalCards.length; i++) {
      const card = portalCards[i];
      if ((card.name || '').trim().length < 2) {
        toast.error(`Карточка портала #${i + 1}: название слишком короткое`);
        return;
      }
      if ((card.desc || '').trim().length < 8) {
        toast.error(`Карточка портала #${i + 1}: описание слишком короткое`);
        return;
      }
      if (!isValidHttpUrl(card.href)) {
        toast.error(`Карточка портала #${i + 1}: некорректная ссылка`);
        return;
      }
      if (card.image && !isValidHttpUrl(card.image)) {
        toast.error(`Карточка портала #${i + 1}: некорректный URL изображения`);
        return;
      }
    }
    for (let i = 0; i < privateReviews.length; i++) {
      const r = privateReviews[i];
      if ((r.author || '').trim().length < 2 || (r.text || '').trim().length < 10) {
        toast.error(`Частный отзыв #${i + 1}: заполните автора и текст (минимум 10 символов)`);
        return;
      }
      if (r.avatar && !isValidHttpUrl(r.avatar)) {
        toast.error(`Частный отзыв #${i + 1}: некорректный URL аватара`);
        return;
      }
    }
    for (let i = 0; i < companyReviews.length; i++) {
      const r = companyReviews[i];
      if ((r.company || '').trim().length < 2 || (r.text || '').trim().length < 10) {
        toast.error(`Отзыв компании #${i + 1}: заполните компанию и текст (минимум 10 символов)`);
        return;
      }
      if (r.logo && !isValidHttpUrl(r.logo)) {
        toast.error(`Отзыв компании #${i + 1}: некорректный URL логотипа`);
        return;
      }
    }
    for (let i = 0; i < aiCannedResponses.length; i++) {
      const row = aiCannedResponses[i];
      if (!row.keywords.length) {
        toast.error(`AI-ответ #${i + 1}: добавьте минимум одно ключевое слово`);
        return;
      }
      if ((row.answer || '').trim().length < 2) {
        toast.error(`AI-ответ #${i + 1}: ответ слишком короткий`);
        return;
      }
    }
    mutation.mutate(payload);
  };

  if (isLoading) {
    return <div className="text-slate-300">Загрузка интеграций...</div>;
  }

  const statusYandexWebmaster = isFilled(form.yandex_webmaster_verification);
  const statusYandexMetrika = isFilled(form.yandex_metrika_counter_id) || isFilled(form.yandex_metrika_tag);
  const statusGoogleAnalytics = isFilled(form.google_analytics_measurement_id) || isFilled(form.google_tag_manager_id);
  const statusRsy = (isFilled(form.yandex_rsy_site_id) && isFilled(form.yandex_rsy_block_id)) || isFilled(form.yandex_rsy_script);
  const statusYookassa = isFilled(form.yookassa_shop_id) && hasSecret;
  const statusCustomHead = isFilled(form.custom_head_html);
  const statusCustomBody = isFilled(form.custom_body_html);
  const statusLandingMedia = carouselCategories.length > 0 && carouselItems.length > 0;

  const addCategory = () => {
    const value = newCategory.trim();
    if (!value) return;
    if (carouselCategories.includes(value)) { toast.error('Категория уже есть'); return; }
    setCarouselCategories((prev) => [...prev, value]);
    setNewCategory('');
  };
  const removeCategory = (category: string) => {
    setCarouselCategories((prev) => prev.filter((c) => c !== category));
    setCarouselItems((prev) => prev.filter((item) => item.category !== category));
  };
  const addCarouselItem = () => {
    const category = carouselCategories[0] || '';
    if (!category) { toast.error('Сначала добавьте категорию'); return; }
    setCarouselItems((prev) => [...prev, { id: crypto.randomUUID(), category, title: '', description: '', media_type: 'image', media_url: '' }]);
  };
  const updateCarouselItem = <K extends keyof LandingCarouselItem>(i: number, key: K, value: LandingCarouselItem[K]) => {
    setCarouselItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [key]: value } : item)));
  };
  const moveItem = (i: number, dir: -1 | 1) => {
    const t = i + dir;
    if (t < 0 || t >= carouselItems.length) return;
    const c = [...carouselItems]; [c[i], c[t]] = [c[t], c[i]]; setCarouselItems(c);
  };
  const removeItem = (i: number) => setCarouselItems((prev) => prev.filter((_, idx) => idx !== i));
  const approvePending = (id: string) => {
    const p = pendingReviews.find((x) => x.id === id);
    if (!p) return;
    if (p.review_type === 'company') {
      setCompanyReviews((prev) => [
        ...prev,
        { company: p.company || 'Компания', text: p.text, logo: p.avatar_or_logo || '/OS_LOGO.png?v=20260320' },
      ]);
    } else {
      setPrivateReviews((prev) => [
        ...prev,
        { author: p.author || 'Пользователь', text: p.text, avatar: p.avatar_or_logo || '' },
      ]);
    }
    setPendingReviews((prev) => prev.filter((x) => x.id !== id));
  };
  const rejectPending = (id: string) => setPendingReviews((prev) => prev.filter((x) => x.id !== id));
  const uploadMediaForItem = async (i: number, file: File | null) => {
    if (!file) return;
    try {
      setUploadingIndex(i);
      const res = await saasApi.uploadLandingMedia(file);
      updateCarouselItem(i, 'media_url', res.url);
      updateCarouselItem(i, 'media_type', file.type.startsWith('video/') ? 'video' : 'image');
      toast.success('Файл загружен');
    } catch { toast.error('Ошибка загрузки'); } finally { setUploadingIndex(null); }
  };
  const uploadReviewImage = async (kind: 'private' | 'company', i: number, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Можно загрузить только изображение');
      return;
    }
    const key = `${kind}-${i}`;
    try {
      setUploadingReviewKey(key);
      const res = await saasApi.uploadLandingMedia(file);
      if (kind === 'private') {
        setPrivateReviews((prev) => prev.map((x, idx) => (idx === i ? { ...x, avatar: res.url } : x)));
      } else {
        setCompanyReviews((prev) => prev.map((x, idx) => (idx === i ? { ...x, logo: res.url } : x)));
      }
      toast.success('Изображение загружено');
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setUploadingReviewKey((curr) => (curr === key ? null : curr));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Интеграции и маркетинг</h1>
        <p className="text-slate-400 mt-1 text-sm">Все секции сворачиваются — кликните на заголовок.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge ok={statusYandexWebmaster} label="Яндекс Вебмастер" />
          <StatusBadge ok={statusYandexMetrika} label="Яндекс Метрика" />
          <StatusBadge ok={statusGoogleAnalytics} label="Google Analytics / GTM" />
          <StatusBadge ok={statusRsy} label="РСЯ" />
          <StatusBadge ok={statusYookassa} label="ЮKassa" />
          <StatusBadge ok={statusCustomHead} label="Custom HEAD" />
          <StatusBadge ok={statusCustomBody} label="Custom BODY" />
          <StatusBadge ok={statusLandingMedia} label={`Карусель: ${carouselCategories.length} кат. / ${carouselItems.length} эл.`} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <Accordion title="Предпросмотр лендинга" defaultOpen>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewTs(Date.now())}
              className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700 text-sm"
            >
              Обновить превью
            </button>
            <a
              href={`/landing2?saas_preview=${previewTs}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-300 text-sm hover:text-cyan-200"
            >
              Открыть в новой вкладке
            </a>
          </div>
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <iframe
              title="Landing preview"
              src={`/landing2?saas_preview=${previewTs}`}
              className="w-full h-[560px] bg-slate-950"
            />
          </div>
        </Accordion>

        {/* ───── Бренд ───── */}
        <Accordion title="Бренд и сайт">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Название продукта</span>
              <input value={form.brand_name} onChange={(e) => setField('brand_name', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" placeholder="AntExpress" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Публичный URL сайта</span>
              <input value={form.public_site_url} onChange={(e) => setField('public_site_url', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" placeholder="https://antexpress.ru" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-slate-300">Лендинг по умолчанию (`/landing`)</span>
              <div className="flex gap-4 mt-1">
                <label className="inline-flex items-center gap-2 text-slate-200">
                  <input
                    type="radio"
                    name="landing-default-version"
                    checked={landingDefaultVersion === 'v1'}
                    onChange={() => setLandingDefaultVersion('v1')}
                  />
                  Landing 1 (классический)
                </label>
                <label className="inline-flex items-center gap-2 text-slate-200">
                  <input
                    type="radio"
                    name="landing-default-version"
                    checked={landingDefaultVersion === 'v2'}
                    onChange={() => setLandingDefaultVersion('v2')}
                  />
                  Landing 2 (новый)
                </label>
              </div>
            </label>
          </div>
        </Accordion>

        {/* ───── Яндекс ───── */}
        <Accordion title="Яндекс: Вебмастер, Метрика, РСЯ" badge={<StatusBadge ok={statusYandexWebmaster || statusYandexMetrika || statusRsy} label={statusYandexWebmaster || statusYandexMetrika || statusRsy ? 'есть' : 'не настроено'} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm"><span className="text-slate-300">Токен Яндекс Вебмастер</span><input value={form.yandex_webmaster_verification} onChange={(e) => setField('yandex_webmaster_verification', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-slate-300">ID Яндекс.Метрики</span><input value={form.yandex_metrika_counter_id} onChange={(e) => setField('yandex_metrika_counter_id', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-slate-300">ID площадки РСЯ</span><input value={form.yandex_rsy_site_id} onChange={(e) => setField('yandex_rsy_site_id', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-slate-300">ID блока РСЯ</span><input value={form.yandex_rsy_block_id} onChange={(e) => setField('yandex_rsy_block_id', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>
          </div>
          <label className="space-y-1 text-sm block"><span className="text-slate-300">Код Яндекс.Метрики (HTML/JS)</span><textarea value={form.yandex_metrika_tag} onChange={(e) => setField('yandex_metrika_tag', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white font-mono text-xs" /></label>
          <label className="space-y-1 text-sm block"><span className="text-slate-300">Код РСЯ (HTML/JS)</span><textarea value={form.yandex_rsy_script} onChange={(e) => setField('yandex_rsy_script', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white font-mono text-xs" /></label>
        </Accordion>

        {/* ───── Google ───── */}
        <Accordion title="Google аналитика" badge={<StatusBadge ok={statusGoogleAnalytics} label={statusGoogleAnalytics ? 'подключено' : 'не настроено'} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm"><span className="text-slate-300">GA Measurement ID</span><input value={form.google_analytics_measurement_id} onChange={(e) => setField('google_analytics_measurement_id', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" placeholder="G-XXXXXXXXXX" /></label>
            <label className="space-y-1 text-sm"><span className="text-slate-300">GTM ID</span><input value={form.google_tag_manager_id} onChange={(e) => setField('google_tag_manager_id', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" placeholder="GTM-XXXXXXX" /></label>
          </div>
        </Accordion>

        {/* ───── ЮKassa ───── */}
        <Accordion title="ЮKassa" badge={<StatusBadge ok={statusYookassa} label={statusYookassa ? 'подключено' : 'не настроено'} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm"><span className="text-slate-300">Shop ID</span><input value={form.yookassa_shop_id} onChange={(e) => setField('yookassa_shop_id', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-slate-300">Return URL</span><input value={form.yookassa_return_url} onChange={(e) => setField('yookassa_return_url', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>
          </div>
          <label className="space-y-1 text-sm block"><span className="text-slate-300">Secret Key {hasSecret ? '(установлен)' : '(не задан)'}</span><input type="password" value={form.yookassa_secret_key} onChange={(e) => setField('yookassa_secret_key', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" placeholder="Пустое = не менять" /></label>
        </Accordion>

        {/* ───── Custom HTML ───── */}
        <Accordion title="Пользовательские HTML вставки" badge={<StatusBadge ok={statusCustomHead || statusCustomBody} label={statusCustomHead || statusCustomBody ? 'есть' : 'пусто'} />}>
          <label className="space-y-1 text-sm block"><span className="text-slate-300">Код в &lt;head&gt;</span><textarea value={form.custom_head_html} onChange={(e) => setField('custom_head_html', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white font-mono text-xs" /></label>
          <label className="space-y-1 text-sm block"><span className="text-slate-300">Код перед &lt;/body&gt;</span><textarea value={form.custom_body_html} onChange={(e) => setField('custom_body_html', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white font-mono text-xs" /></label>
        </Accordion>

        {/* ───── Карусель ───── */}
        <Accordion
          title="Учебная карусель на лендинге"
          badge={<StatusBadge ok={statusLandingMedia} label={`${carouselCategories.length} кат. / ${carouselItems.length} эл.`} />}
        >
          {/* Категории */}
          <div className="rounded-lg border border-slate-600 p-3 space-y-3">
            <p className="text-sm text-slate-200 font-medium">Категории</p>
            <div className="flex flex-wrap gap-2">
              {carouselCategories.map((cat) => {
                const isDefault = defaultCategory === cat;
                return (
                  <span key={cat} className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-white ${isDefault ? 'bg-fuchsia-600/60 ring-1 ring-fuchsia-400' : 'bg-slate-700'}`}>
                    <button
                      type="button"
                      onClick={() => setDefaultCategory(isDefault ? '' : cat)}
                      className={`transition-colors ${isDefault ? 'text-yellow-300' : 'text-slate-400 hover:text-yellow-300'}`}
                      title={isDefault ? 'Снять «по умолчанию»' : 'Сделать категорией по умолчанию'}
                    >
                      {isDefault ? '★' : '☆'}
                    </button>
                    {cat}
                    <button type="button" onClick={() => { removeCategory(cat); if (isDefault) setDefaultCategory(''); }} className="text-rose-300 hover:text-white" aria-label={`Удалить ${cat}`}>✕</button>
                  </span>
                );
              })}
              {!carouselCategories.length && <span className="text-xs text-slate-500">Нет категорий. На лендинге используются дефолтные.</span>}
            </div>
            {defaultCategory && <p className="text-xs text-fuchsia-300">★ По умолчанию на лендинге: <strong>{defaultCategory}</strong></p>}
            <div className="flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                placeholder="Новая категория..."
                className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm"
              />
              <button type="button" onClick={addCategory} className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-sm shrink-0">+ Категория</button>
            </div>
          </div>

          {/* Элементы */}
          <div className="rounded-lg border border-slate-600 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-200 font-medium">Элементы карусели ({carouselItems.length})</p>
              <button type="button" onClick={addCarouselItem} className="px-3 py-1.5 rounded-lg bg-fuchsia-600/70 text-white hover:bg-fuchsia-500 text-sm">+ Элемент</button>
            </div>
            {!carouselItems.length && <p className="text-xs text-slate-500">Нет элементов. На лендинге используются дефолтные изображения.</p>}

            <div className="space-y-2">
              {carouselItems.map((item, idx) => (
                <CarouselItemCard
                  key={item.id || idx}
                  item={item}
                  index={idx}
                  total={carouselItems.length}
                  categories={carouselCategories}
                  uploading={uploadingIndex === idx}
                  onUpdate={(key, value) => updateCarouselItem(idx, key, value)}
                  onMove={(dir) => moveItem(idx, dir)}
                  onRemove={() => removeItem(idx)}
                  onUpload={(file) => void uploadMediaForItem(idx, file)}
                />
              ))}
            </div>
          </div>
        </Accordion>

        <Accordion
          title="Сеть порталов: карточки секции"
          badge={<StatusBadge ok={portalCards.length > 0} label={`Карточек: ${portalCards.length}`} />}
        >
          <div className="rounded-lg border border-slate-600 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-200 font-medium">Карточки лендинга (изображение, название, описание, ссылка)</p>
              <button
                type="button"
                onClick={() => setPortalCards((prev) => [...prev, { name: '', desc: '', href: '', image: '' }])}
                className="px-3 py-1.5 rounded-lg bg-teal-700/70 text-white hover:bg-teal-600 text-sm"
              >
                + Карточка
              </button>
            </div>
            {!portalCards.length && <p className="text-xs text-slate-500">Пока нет карточек. Можно добавить свои.</p>}
            {portalCards.map((card, i) => (
              <details key={`${card.name}-${i}`} className="rounded-lg border border-slate-700 p-2">
                <summary className="cursor-pointer text-sm text-white">
                  {card.name || `Карточка #${i + 1}`} — {shortText(card.desc, 70)}
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <input
                    value={card.name}
                    onChange={(e) => setPortalCards((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                    className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                    placeholder="Название"
                  />
                  <input
                    value={card.href}
                    onChange={(e) => setPortalCards((prev) => prev.map((x, idx) => idx === i ? { ...x, href: e.target.value } : x))}
                    className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                    placeholder="https://..."
                  />
                  <input
                    value={card.image}
                    onChange={(e) => setPortalCards((prev) => prev.map((x, idx) => idx === i ? { ...x, image: e.target.value } : x))}
                    className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white md:col-span-2"
                    placeholder="URL изображения"
                  />
                  <textarea
                    value={card.desc}
                    onChange={(e) => setPortalCards((prev) => prev.map((x, idx) => idx === i ? { ...x, desc: e.target.value } : x))}
                    rows={2}
                    className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white md:col-span-2"
                    placeholder="Описание"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPortalCards((prev) => {
                          const next = [...prev];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return next;
                        })
                      }
                      className="px-2 py-1 rounded bg-slate-700 text-xs text-white"
                    >
                      ↑
                    </button>
                  )}
                  {i < portalCards.length - 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPortalCards((prev) => {
                          const next = [...prev];
                          [next[i + 1], next[i]] = [next[i], next[i + 1]];
                          return next;
                        })
                      }
                      className="px-2 py-1 rounded bg-slate-700 text-xs text-white"
                    >
                      ↓
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPortalCards((prev) => prev.filter((_, idx) => idx !== i))}
                    className="px-2 py-1 rounded bg-rose-600/80 text-xs text-white"
                  >
                    Удалить
                  </button>
                </div>
              </details>
            ))}
          </div>
        </Accordion>

        <Accordion
          title="Тарифы: неон-цвета карточек"
          badge={<StatusBadge ok={planStyles.length > 0} label={`Схем: ${planStyles.length}`} />}
        >
          <div className="rounded-lg border border-slate-600 p-3 space-y-3">
            <p className="text-sm text-slate-200 font-medium">Настройка цвета рамки и свечения по каждому тарифу</p>
            {(saasPlans || []).map((plan) => {
              const idx = planStyles.findIndex((x) => x.plan_name === plan.name);
              const current = idx >= 0 ? planStyles[idx] : { plan_name: plan.name, border_color: '#64748b', glow_color: '#38bdf8' };
              return (
                <div key={plan.id} className="rounded-lg border border-slate-700 p-2">
                  <p className="text-sm text-white mb-2">{plan.name}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <label className="text-xs text-slate-300 flex items-center gap-2">
                      Рамка
                      <input
                        type="color"
                        value={current.border_color}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlanStyles((prev) => {
                            const copy = [...prev];
                            const i = copy.findIndex((x) => x.plan_name === plan.name);
                            if (i >= 0) copy[i] = { ...copy[i], border_color: val };
                            else copy.push({ plan_name: plan.name, border_color: val, glow_color: current.glow_color });
                            return copy;
                          });
                        }}
                        className="w-10 h-8 rounded bg-transparent border border-slate-600"
                      />
                      <span className="text-slate-400">{current.border_color}</span>
                    </label>
                    <label className="text-xs text-slate-300 flex items-center gap-2">
                      Свечение
                      <input
                        type="color"
                        value={current.glow_color}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlanStyles((prev) => {
                            const copy = [...prev];
                            const i = copy.findIndex((x) => x.plan_name === plan.name);
                            if (i >= 0) copy[i] = { ...copy[i], glow_color: val };
                            else copy.push({ plan_name: plan.name, border_color: current.border_color, glow_color: val });
                            return copy;
                          });
                        }}
                        className="w-10 h-8 rounded bg-transparent border border-slate-600"
                      />
                      <span className="text-slate-400">{current.glow_color}</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </Accordion>

        <Accordion
          title="AI-чатбот лендинга: дежурные ответы"
          badge={<StatusBadge ok={aiCannedResponses.length > 0} label={`Фраз: ${aiCannedResponses.length}`} />}
        >
          <div className="rounded-lg border border-slate-600 p-3 space-y-3">
            <p className="text-sm text-slate-200 font-medium">
              Настройка шаблонных ответов по ключевым словам (до подключения полноценного ИИ)
            </p>
            <label className="space-y-1 text-sm block">
              <span className="text-slate-300">Фолбэк-ответ (если ключевые слова не найдены)</span>
              <textarea
                value={aiFallbackReply}
                onChange={(e) => setAiFallbackReply(e.target.value)}
                rows={2}
                className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                placeholder="Введите ответ по умолчанию..."
              />
            </label>
            <button
              type="button"
              onClick={() => setAiCannedResponses((prev) => [...prev, { keywords: [], answer: '' }])}
              className="px-3 py-1.5 rounded bg-cyan-700/70 text-sm text-white hover:bg-cyan-600"
            >
              + Добавить дежурный ответ
            </button>
            {!aiCannedResponses.length && (
              <p className="text-xs text-slate-500">Пока нет шаблонов. Добавьте хотя бы один ответ.</p>
            )}
            {aiCannedResponses.map((row, i) => (
              <details key={`ai-row-${i}`} className="rounded-lg border border-slate-700 p-2">
                <summary className="cursor-pointer text-sm text-white">
                  Ответ #{i + 1} — {shortText(row.answer, 70) || 'без текста'}
                </summary>
                <div className="space-y-2 mt-2">
                  <input
                    value={row.keywords.join(', ')}
                    onChange={(e) =>
                      setAiCannedResponses((prev) =>
                        prev.map((x, idx) =>
                          idx === i
                            ? {
                                ...x,
                                keywords: e.target.value
                                  .split(',')
                                  .map((k) => k.trim().toLowerCase())
                                  .filter(Boolean),
                              }
                            : x,
                        ),
                      )
                    }
                    className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                    placeholder="Ключевые слова через запятую: цена, тариф, оплата"
                  />
                  <textarea
                    value={row.answer}
                    onChange={(e) =>
                      setAiCannedResponses((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, answer: e.target.value } : x)),
                      )
                    }
                    rows={3}
                    className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                    placeholder="Текст ответа..."
                  />
                  <button
                    type="button"
                    onClick={() => setAiCannedResponses((prev) => prev.filter((_, idx) => idx !== i))}
                    className="px-2 py-1 rounded bg-rose-600/80 text-xs text-white"
                  >
                    Удалить
                  </button>
                </div>
              </details>
            ))}
            <div className="pt-2 border-t border-slate-700">
              <p className="text-sm text-slate-200 font-medium mb-2">Логи чата (последние 30)</p>
              {!aiChatLogs.length && <p className="text-xs text-slate-500">Пока нет сообщений.</p>}
              {aiChatLogs
                .slice(-30)
                .reverse()
                .map((log) => (
                  <div key={log.id} className="rounded border border-slate-700 bg-slate-900/60 p-2 mb-2">
                    <p className="text-[11px] text-slate-400">
                      {log.created_at || '—'} · session: {log.session_id} · {log.role} · {log.user_username || 'guest'}
                    </p>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap mt-1">{log.message}</p>
                  </div>
                ))}
            </div>
          </div>
        </Accordion>

        <Accordion
          title="Отзывы и заявки с лендинга"
          badge={<StatusBadge ok={privateReviews.length + companyReviews.length > 0} label={`Отзывы: ${privateReviews.length + companyReviews.length} / Черновики: ${pendingReviews.length} / Заявки: ${leadRequests.length}`} />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-600 p-3 space-y-2">
              <p className="text-sm text-slate-200 font-medium">Частные отзывы (публикация)</p>
              {privateReviews.map((r, i) => (
                <details key={`private-review-${i}`} className="rounded-lg border border-slate-700 p-2">
                  <summary className="cursor-pointer text-sm text-white">
                    {r.author || `Частный отзыв #${i + 1}`} — {shortText(r.text, 70)}
                  </summary>
                  <div className="space-y-2 mt-2">
                    <input value={r.author} onChange={(e) => setPrivateReviews((prev) => prev.map((x, idx) => idx === i ? { ...x, author: e.target.value } : x))} className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white" placeholder="Автор" />
                    <textarea value={r.text} onChange={(e) => setPrivateReviews((prev) => prev.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))} rows={3} className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white" placeholder="Текст" />
                    <input value={r.avatar || ''} onChange={(e) => setPrivateReviews((prev) => prev.map((x, idx) => idx === i ? { ...x, avatar: e.target.value } : x))} className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white" placeholder="URL аватара" />
                    <div className="flex items-center gap-2">
                      <label className="px-2 py-1 rounded border border-slate-500 text-xs text-slate-100 cursor-pointer hover:bg-slate-700">
                        {uploadingReviewKey === `private-${i}` ? 'Загрузка...' : 'Загрузить аватар'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            void uploadReviewImage('private', i, f);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                      {Boolean(r.avatar) && <span className="text-[11px] text-emerald-300">Аватар задан</span>}
                    </div>
                    <button type="button" onClick={() => setPrivateReviews((prev) => prev.filter((_, idx) => idx !== i))} className="px-2 py-1 rounded bg-rose-600/70 text-xs text-white">Удалить</button>
                  </div>
                </details>
              ))}
              <button type="button" onClick={() => setPrivateReviews((prev) => [...prev, { author: '', text: '', avatar: '' }])} className="px-3 py-1.5 rounded bg-slate-700 text-sm text-white">+ Добавить частный отзыв</button>
            </div>
            <div className="rounded-lg border border-slate-600 p-3 space-y-2">
              <p className="text-sm text-slate-200 font-medium">Корпоративные отзывы (публикация)</p>
              {companyReviews.map((r, i) => (
                <details key={`company-review-${i}`} className="rounded-lg border border-slate-700 p-2">
                  <summary className="cursor-pointer text-sm text-white">
                    {r.company || `Компания #${i + 1}`} — {shortText(r.text, 70)}
                  </summary>
                  <div className="space-y-2 mt-2">
                    <input value={r.company} onChange={(e) => setCompanyReviews((prev) => prev.map((x, idx) => idx === i ? { ...x, company: e.target.value } : x))} className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white" placeholder="Компания" />
                    <textarea value={r.text} onChange={(e) => setCompanyReviews((prev) => prev.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))} rows={3} className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white" placeholder="Текст" />
                    <input value={r.logo} onChange={(e) => setCompanyReviews((prev) => prev.map((x, idx) => idx === i ? { ...x, logo: e.target.value } : x))} className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white" placeholder="URL логотипа" />
                    <div className="flex items-center gap-2">
                      <label className="px-2 py-1 rounded border border-slate-500 text-xs text-slate-100 cursor-pointer hover:bg-slate-700">
                        {uploadingReviewKey === `company-${i}` ? 'Загрузка...' : 'Загрузить логотип'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            void uploadReviewImage('company', i, f);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                      {Boolean(r.logo) && <span className="text-[11px] text-emerald-300">Логотип задан</span>}
                    </div>
                    <button type="button" onClick={() => setCompanyReviews((prev) => prev.filter((_, idx) => idx !== i))} className="px-2 py-1 rounded bg-rose-600/70 text-xs text-white">Удалить</button>
                  </div>
                </details>
              ))}
              <button type="button" onClick={() => setCompanyReviews((prev) => [...prev, { company: '', text: '', logo: '' }])} className="px-3 py-1.5 rounded bg-slate-700 text-sm text-white">+ Добавить отзыв компании</button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-600 p-3 space-y-2">
            <p className="text-sm text-slate-200 font-medium">Черновики отзывов (с формы лендинга)</p>
            {!pendingReviews.length && <p className="text-xs text-slate-500">Пока нет черновиков.</p>}
            {pendingReviews.map((r) => (
              <details key={r.id} className="rounded-lg border border-slate-700 p-2">
                <summary className="cursor-pointer text-sm text-white">
                  {r.review_type === 'company' ? 'Компания' : 'Частный'} — {shortText(r.text, 80)}
                </summary>
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-slate-400">{r.created_at || ''}</p>
                  {r.user_username && <p className="text-[11px] text-cyan-300">Пользователь: {r.user_username} (id: {r.user_id ?? 'n/a'})</p>}
                  {r.review_type === 'company' ? (
                    <input
                      value={r.company || ''}
                      onChange={(e) => setPendingReviews((prev) => prev.map((x) => x.id === r.id ? { ...x, company: e.target.value } : x))}
                      className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                      placeholder="Компания"
                    />
                  ) : (
                    <input
                      value={r.author || ''}
                      onChange={(e) => setPendingReviews((prev) => prev.map((x) => x.id === r.id ? { ...x, author: e.target.value } : x))}
                      className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                      placeholder="Автор"
                    />
                  )}
                  <textarea
                    value={r.text}
                    onChange={(e) => setPendingReviews((prev) => prev.map((x) => x.id === r.id ? { ...x, text: e.target.value } : x))}
                    rows={3}
                    className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                    placeholder="Текст отзыва"
                  />
                  <input
                    value={r.avatar_or_logo || ''}
                    onChange={(e) => setPendingReviews((prev) => prev.map((x) => x.id === r.id ? { ...x, avatar_or_logo: e.target.value } : x))}
                    className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                    placeholder="URL аватара/логотипа"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => approvePending(r.id)} className="px-2 py-1 rounded bg-emerald-600/80 text-xs text-white">Опубликовать</button>
                    <button type="button" onClick={() => rejectPending(r.id)} className="px-2 py-1 rounded bg-rose-600/80 text-xs text-white">Отклонить</button>
                  </div>
                </div>
              </details>
            ))}
          </div>

          <div className="rounded-lg border border-slate-600 p-3 space-y-2">
            <p className="text-sm text-slate-200 font-medium">Заявки (с формы лендинга)</p>
            {!leadRequests.length && <p className="text-xs text-slate-500">Пока нет заявок.</p>}
            {leadRequests.slice().reverse().map((l) => (
              <details key={l.id} className="rounded-lg border border-slate-700 p-2">
                <summary className="cursor-pointer text-sm text-white">
                  {l.name} — {l.contact}
                </summary>
                <div className="mt-2">
                  <p className="text-xs text-slate-400">{l.created_at || ''} · {l.source || 'landing'}</p>
                  {l.user_username && <p className="text-[11px] text-cyan-300">Пользователь: {l.user_username} (id: {l.user_id ?? 'n/a'})</p>}
                  {l.message && <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap">{l.message}</p>}
                </div>
              </details>
            ))}
          </div>
        </Accordion>

        <Accordion
          title="История настроек и откат"
          badge={<StatusBadge ok={settingsHistory.length > 0} label={`Версий: ${settingsHistory.length}`} />}
        >
          <div className="rounded-lg border border-slate-600 p-3 space-y-2">
            {settingsHistory.length === 0 && <p className="text-xs text-slate-500">История пока пустая.</p>}
            {settingsHistory.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-700 p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{item.brand_name || 'Без названия'} · {item.public_site_url || 'URL не задан'}</p>
                  <p className="text-xs text-slate-400">{item.created_at || ''} · user #{item.updated_by ?? 'n/a'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => rollbackMutation.mutate(item.id)}
                  disabled={rollbackMutation.isPending}
                  className="px-3 py-1.5 rounded bg-amber-600/80 text-xs text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  Откатить
                </button>
              </div>
            ))}
          </div>
        </Accordion>

        {/* ───── Кнопки ───── */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={mutation.isPending} className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 disabled:opacity-50">
            {mutation.isPending ? 'Сохраняю...' : 'Сохранить все настройки'}
          </button>
          <button type="button" onClick={() => refetch()} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700">Обновить</button>
        </div>
      </form>
    </div>
  );
}

function CarouselItemCard({
  item,
  index,
  total,
  categories,
  uploading,
  onUpdate,
  onMove,
  onRemove,
  onUpload,
}: {
  item: LandingCarouselItem;
  index: number;
  total: number;
  categories: string[];
  uploading: boolean;
  onUpdate: <K extends keyof LandingCarouselItem>(key: K, value: LandingCarouselItem[K]) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onUpload: (file: File) => void;
}) {
  const [expanded, setExpanded] = useState(!item.media_url);
  const hasThumb = Boolean(item.media_url);

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700/30 transition-colors"
      >
        {hasThumb && item.media_type === 'image' && (
          <img src={item.media_url} alt="" className="w-12 h-8 rounded object-cover shrink-0 bg-black" />
        )}
        {hasThumb && item.media_type === 'video' && (
          <span className="w-12 h-8 rounded bg-black flex items-center justify-center text-xs text-white shrink-0">▶</span>
        )}
        {!hasThumb && (
          <span className="w-12 h-8 rounded bg-slate-700 flex items-center justify-center text-xs text-slate-400 shrink-0">?</span>
        )}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm text-white truncate">{item.title || `Элемент #${index + 1}`}</p>
          <p className="text-[10px] text-slate-400">{item.category} · {item.media_type}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {index > 0 && <button type="button" onClick={() => onMove(-1)} className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-white">↑</button>}
          {index < total - 1 && <button type="button" onClick={() => onMove(1)} className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-white">↓</button>}
          <button type="button" onClick={onRemove} className="px-1.5 py-0.5 rounded bg-rose-600/70 text-[10px] text-white">✕</button>
        </div>
        <span className={`text-slate-400 text-sm transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Категория</span>
              <select value={item.category} onChange={(e) => onUpdate('category', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Тип</span>
              <select value={item.media_type} onChange={(e) => onUpdate('media_type', e.target.value as 'image' | 'video')} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm">
                <option value="image">Изображение</option>
                <option value="video">Видео</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Заголовок</span>
              <input value={item.title || ''} onChange={(e) => onUpdate('title', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Описание</span>
              <input value={item.description || ''} onChange={(e) => onUpdate('description', e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm" />
            </label>
          </div>
          <label className="space-y-1 text-sm block">
            <span className="text-slate-300">URL медиа</span>
            <input value={item.media_url} onChange={(e) => onUpdate('media_url', e.target.value)} placeholder="/media/..." className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white text-sm" />
          </label>
          <div className="flex items-center gap-3">
            <label className="px-3 py-1.5 rounded-lg border border-slate-500 text-sm text-slate-100 cursor-pointer hover:bg-slate-700">
              {uploading ? 'Загрузка...' : 'Загрузить файл'}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ''; }} />
            </label>
            {hasThumb && <span className="text-xs text-emerald-300">URL задан</span>}
          </div>
        </div>
      )}
    </div>
  );
}
