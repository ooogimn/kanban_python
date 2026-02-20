/**
 * Рекламный блок внутри статьи блога — слот blog_content.
 * Показывает одно объявление (первое из слота) по середине контента.
 */
import { useQuery } from '@tanstack/react-query';
import { marketingApi, type AdItem } from '../api/marketing';

function AdBlock({ ad }: { ad: AdItem }) {
  const content =
    ad.content_type === 'html' && ad.html_code ? (
      <div
        className="my-8 w-full overflow-hidden rounded-2xl bg-slate-800/50 p-4 text-slate-300 [&_img]:max-w-full [&_a]:text-imperial-gold"
        dangerouslySetInnerHTML={{ __html: ad.html_code }}
      />
    ) : ad.content_type === 'video' && ad.video_url ? (
      <a
        href={ad.link || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="my-8 block w-full overflow-hidden rounded-2xl bg-black"
      >
        <video
          src={ad.video_url}
          className="w-full max-h-80 object-contain"
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
        className="my-8 block w-full overflow-hidden rounded-2xl bg-slate-800/50"
      >
        <img
          src={ad.image_url || ad.image || ''}
          alt={ad.title}
          className="w-full h-auto object-contain"
        />
      </a>
    ) : null;

  if (!content) return null;
  return (
    <div className="w-full" role="complementary" aria-label="Реклама">
      {content}
    </div>
  );
}

export default function BlogAdInContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['marketing-ads'],
    queryFn: () => marketingApi.getAds(),
  });

  const blogAds = data?.blog_content ?? [];
  const ad = blogAds[0];
  if (isLoading || !ad) return null;

  return <AdBlock ad={ad} />;
}
