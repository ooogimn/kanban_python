/**
 * Сетка рекламных блоков в подвале: 3 колонки (footer_col_1, footer_col_2, footer_col_3).
 * Показывается только при plan_type === 'personal' (родитель управляет условием).
 */
import { useQuery } from '@tanstack/react-query';
import { marketingApi, type AdItem } from '../api/marketing';

function AdBlock({ ad }: { ad: AdItem }) {
  const content =
    ad.content_type === 'html' && ad.html_code ? (
      <div
        className="min-h-[80px] w-full overflow-hidden rounded-lg bg-slate-800/50 p-3 text-slate-300 text-sm [&_img]:max-w-full [&_a]:text-imperial-gold"
        dangerouslySetInnerHTML={{ __html: ad.html_code }}
      />
    ) : ad.content_type === 'video' && ad.video_url ? (
      <a
        href={ad.link || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full overflow-hidden rounded-lg bg-slate-800/50 p-2"
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
        className="block w-full overflow-hidden rounded-lg bg-slate-800/50 p-2"
      >
        <img
          src={ad.image_url || ad.image || ''}
          alt={ad.title}
          className="max-w-full h-auto object-contain"
        />
      </a>
    ) : (
      <div className="min-h-[80px] w-full rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-500 text-xs p-2">
        {ad.title}
      </div>
    );

  return <div className="w-full overflow-hidden">{content}</div>;
}

function Column({ ads, slot }: { ads: AdItem[]; slot: string }) {
  if (!ads.length) return <div className="min-h-[60px]" aria-hidden />;
  return (
    <div className="space-y-2" role="complementary" aria-label={`Реклама ${slot}`}>
      {ads.map((ad) => (
        <AdBlock key={ad.id} ad={ad} />
      ))}
    </div>
  );
}

export default function FooterAdGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ['marketing-ads'],
    queryFn: () => marketingApi.getAds(),
  });

  if (isLoading) return null;
  const col1 = data?.footer_col_1 ?? [];
  const col2 = data?.footer_col_2 ?? [];
  const col3 = data?.footer_col_3 ?? [];
  if (col1.length === 0 && col2.length === 0 && col3.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mx-auto py-4">
      <Column ads={col1} slot="footer_col_1" />
      <Column ads={col2} slot="footer_col_2" />
      <Column ads={col3} slot="footer_col_3" />
    </div>
  );
}
