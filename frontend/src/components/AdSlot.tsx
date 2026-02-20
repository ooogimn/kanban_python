/**
 * Рекламный блок для сайдбара. Загружает данные из /api/v1/marketing/ads/, слот sidebar.
 * Если массив пуст — ничего не рендерит.
 */
import { useQuery } from '@tanstack/react-query';
import { marketingApi, type AdItem } from '../api/marketing';

function AdBlock({ ad }: { ad: AdItem }) {
  const content =
    ad.content_type === 'html' && ad.html_code ? (
      <div
        className="min-h-[100px] w-full overflow-hidden rounded-xl [&_img]:max-w-full [&_a]:text-imperial-gold"
        dangerouslySetInnerHTML={{ __html: ad.html_code }}
      />
    ) : ad.content_type === 'video' && ad.video_url ? (
      <a
        href={ad.link || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full overflow-hidden rounded-xl"
      >
        <video
          src={ad.video_url}
          className="max-w-full h-auto object-contain"
          muted
          loop
          playsInline
          autoPlay
          controls
        />
      </a>
    ) : ad.image_url || ad.image ? (
      <a
        href={ad.link || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full overflow-hidden rounded-xl"
      >
        <img
          src={ad.image_url || ad.image || ''}
          alt={ad.title}
          className="max-w-full h-auto object-contain"
        />
      </a>
    ) : (
      <div className="min-h-[100px] w-full rounded-xl bg-slate-700/50 flex items-center justify-center text-slate-400 text-xs">
        {ad.title}
      </div>
    );

  return <div className="w-full overflow-hidden">{content}</div>;
}

export default function AdSlot() {
  const { data, isLoading } = useQuery({
    queryKey: ['marketing-ads'],
    queryFn: () => marketingApi.getAds(),
  });

  const sidebar = data?.sidebar ?? [];
  if (isLoading || sidebar.length === 0) return null;

  return (
    <div className="w-full overflow-hidden" aria-label="Рекламный блок">
      {sidebar.map((ad) => (
        <AdBlock key={ad.id} ad={ad} />
      ))}
    </div>
  );
}
