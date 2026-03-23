const FALLBACK_PUBLIC_SITE_URL = 'https://antexpress.ru';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getPublicSiteUrl(): string {
  const envUrl = String(import.meta.env.VITE_PUBLIC_SITE_URL || '').trim();
  if (envUrl) return trimTrailingSlash(envUrl);

  if (typeof window !== 'undefined' && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }

  return FALLBACK_PUBLIC_SITE_URL;
}

export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const base = getPublicSiteUrl();
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${normalizedPath}`;
}
