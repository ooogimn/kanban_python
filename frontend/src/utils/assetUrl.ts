/**
 * Преобразует URL аватара/ассета из API в URL с учётом base path приложения.
 * Относительные пути (например /AI-Analitik.png из БД) при развёртывании не в корне
 * иначе запрашиваются с корня домена и дают 404.
 */
export function getAssetUrl(url: string | null | undefined): string {
  if (url == null || url === '') return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '';
  return `${base}${url}`;
}
