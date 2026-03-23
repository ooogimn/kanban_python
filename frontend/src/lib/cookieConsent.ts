export const COOKIE_CONSENT_STORAGE_KEY = 'cookie_consent';

export type CookieConsentChoice = 'all' | 'necessary' | 'none';

const OPEN_COOKIE_SETTINGS_EVENT = 'cookie-consent:open-settings';

export function getCookieConsent(): CookieConsentChoice | null {
  try {
    const saved = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (saved === 'all' || saved === 'necessary' || saved === 'none') {
      return saved;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCookieConsent(choice: CookieConsentChoice): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
  } catch {
    // ignore storage errors
  }
}

export function resetCookieConsent(): void {
  try {
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function canUseAnalytics(): boolean {
  return getCookieConsent() === 'all';
}

export function canUseMarketing(): boolean {
  return getCookieConsent() === 'all';
}

export function canUseNecessary(): boolean {
  const consent = getCookieConsent();
  return consent === 'all' || consent === 'necessary' || consent === null;
}

export function openCookieConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

export function onOpenCookieConsentSettings(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handler);
  return () => {
    window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handler);
  };
}
