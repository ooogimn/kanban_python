import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saasApi, type SaasAd, type SaasAdCreate } from '../../api/saas';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Plus } from 'lucide-react';

const SLOT_OPTIONS = [
  { value: 'sidebar', label: 'Сайдбар' },
  { value: 'footer_col_1', label: 'Подвал кол. 1' },
  { value: 'footer_col_2', label: 'Подвал кол. 2' },
  { value: 'footer_col_3', label: 'Подвал кол. 3' },
  { value: 'blog_content', label: 'Блог (в статье)' },
];

const CONTENT_TYPES = [
  { value: 'image', label: 'Картинка' },
  { value: 'video', label: 'Видео' },
  { value: 'html', label: 'HTML' },
];

function AdModal({
  ad,
  onClose,
  onSuccess,
}: {
  ad: SaasAd | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(ad?.title ?? '');
  const [slot, setSlot] = useState(ad?.slot ?? 'sidebar');
  const [contentType, setContentType] = useState(ad?.content_type ?? 'image');
  const [htmlCode, setHtmlCode] = useState(ad?.html_code ?? '');
  const [link, setLink] = useState(ad?.link ?? '');
  const [isActive, setIsActive] = useState(ad?.is_active ?? true);
  const [width, setWidth] = useState(ad?.width ?? '');
  const [height, setHeight] = useState(ad?.height ?? '');
  const [sortOrder, setSortOrder] = useState(ad?.sort_order ?? 0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: FormData | SaasAdCreate) => saasApi.createAd(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-ads'] });
      toast.success('Объявление создано');
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData | Partial<SaasAdCreate>) =>
      saasApi.updateAd(ad!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-ads'] });
      toast.success('Объявление обновлено');
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Введите название');
      return;
    }
    const payload: SaasAdCreate = {
      title: title.trim(),
      slot,
      content_type: contentType,
      html_code: htmlCode,
      link: link.trim() || undefined,
      is_active: isActive,
      width: width ? parseInt(width, 10) : null,
      height: height ? parseInt(height, 10) : null,
      sort_order: sortOrder,
    };
    if (imageFile || videoFile) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null)
          fd.append(k, typeof v === 'boolean' ? String(v) : String(v));
      });
      if (imageFile) fd.append('image', imageFile);
      if (videoFile) fd.append('video', videoFile);
      if (ad) updateMutation.mutate(fd);
      else createMutation.mutate(fd);
    } else {
      if (ad) updateMutation.mutate(payload);
      else createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl my-8">
        <h2 className="text-xl font-bold text-white mb-4">
          {ad ? 'Редактировать объявление' : 'Создать объявление'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Название *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Слот</label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
              >
                {SLOT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Тип контента</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
              >
                {CONTENT_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {contentType === 'image' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Изображение</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="w-full text-slate-300 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-red-900/50 file:text-red-200"
              />
              {ad?.image_url && !imageFile && (
                <p className="text-xs text-slate-500 mt-1">Текущее: загружено (превью в списке)</p>
              )}
            </div>
          )}
          {contentType === 'video' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Видео</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                className="w-full text-slate-300 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-red-900/50 file:text-red-200"
              />
              {ad?.video_url && !videoFile && (
                <p className="text-xs text-slate-500 mt-1">Текущее: загружено</p>
              )}
            </div>
          )}
          {contentType === 'html' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">HTML-код</label>
              <textarea
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2 font-mono text-sm"
                placeholder="<div>...</div> или вставка видео/текста"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Ссылка</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Ширина (px)</label>
              <input
                type="number"
                min={0}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Высота (px)</label>
              <input
                type="number"
                min={0}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Порядок</label>
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                className="w-24 rounded-lg border border-slate-600 bg-slate-700 text-white px-3 py-2"
              />
            </div>
            <label className="flex items-center gap-2 text-slate-300 pt-6">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Включено
            </label>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50"
            >
              {ad ? 'Сохранить' : 'Создать'}
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
  );
}

export default function SaasAdsPage() {
  const queryClient = useQueryClient();
  const [modalAd, setModalAd] = useState<SaasAd | null | 'create'>(null);

  const { data: ads = [], isLoading, error } = useQuery({
    queryKey: ['saas-ads'],
    queryFn: () => saasApi.getAds(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => saasApi.deleteAd(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-ads'] });
      toast.success('Объявление удалено');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      saasApi.updateAd(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-ads'] });
      toast.success('Статус обновлён');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-300">
        Ошибка загрузки рекламы.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Реклама</h1>
        <button
          type="button"
          onClick={() => setModalAd('create')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500"
        >
          <Plus className="w-4 h-4" />
          Создать объявление
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-8 text-center text-slate-400">
          Загрузка…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-600 bg-slate-800/80">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase w-24">
                  Превью
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                  Название
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                  Слот / Тип
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase">
                  Включено
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                  Размер
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {ads.map((a) => (
                <tr key={a.id} className="border-b border-slate-600/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    {a.content_type === 'video' && a.video_url ? (
                      <div className="w-20 h-14 rounded overflow-hidden bg-slate-700 flex items-center justify-center">
                        <video
                          src={a.video_url}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                      </div>
                    ) : a.image_url ? (
                      <img
                        src={a.image_url}
                        alt=""
                        className="w-20 h-14 rounded object-cover bg-slate-700"
                      />
                    ) : (
                      <div className="w-20 h-14 rounded bg-slate-700 flex items-center justify-center text-slate-500 text-xs">
                        {a.content_type === 'html' ? 'HTML' : '—'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{a.title}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {a.slot} / {a.content_type}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          id: a.id,
                          isActive: !a.is_active,
                        })
                      }
                      disabled={toggleActiveMutation.isPending}
                      className={`px-2 py-1 rounded text-sm font-medium ${
                        a.is_active
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-slate-700 text-slate-500'
                      }`}
                    >
                      {a.is_active ? 'Вкл' : 'Выкл'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-sm">
                    {a.width != null && a.height != null
                      ? `${a.width}×${a.height}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setModalAd(a)}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-600"
                        title="Редактировать"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          window.confirm('Удалить объявление?') && deleteMutation.mutate(a.id)
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
          {ads.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              Нет объявлений. Создайте первое.
            </div>
          )}
        </div>
      )}

      {modalAd !== null && (
        <AdModal
          ad={modalAd === 'create' ? null : modalAd}
          onClose={() => setModalAd(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
