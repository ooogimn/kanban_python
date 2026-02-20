import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'theme-state';

/** Применяет тему к <html>: добавляет/убирает класс "dark". */
export function applyThemeToDom(isDark: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/** Синхронизация темы с DOM при загрузке. По умолчанию — тёмная (Cyber-Imperial). */
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      applyThemeToDom(true);
      return true;
    }
    const parsed = JSON.parse(raw);
    const saved = parsed?.state?.isDark ?? parsed?.isDark;
    const isDark = saved === true || (saved !== false && saved !== 'false');
    applyThemeToDom(isDark);
    return isDark;
  } catch {
    applyThemeToDom(true);
    return true;
  }
}

const initialDark = getInitialTheme();

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: initialDark,
      toggle: () =>
        set((s) => {
          const next = !s.isDark;
          applyThemeToDom(next);
          return { isDark: next };
        }),
    }),
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeToDom(state.isDark);
      },
    }
  )
);

/** Подписка на стор и синхронизация темы с DOM при смене в другом табе/окне. */
useThemeStore.subscribe((state) => {
  applyThemeToDom(state.isDark);
});
