/**
 * UI-индикация оффлайн-режима (Task 3.3 Offline-First).
 *
 * Слушает online/offline события, показывает плашку и экспортирует useNetworkStatus.
 */
import { useState, useEffect } from 'react';
import { create } from 'zustand';

/** Глобальное состояние сети (для disabled кнопок в формах). */
interface NetworkStore {
  isOnline: boolean;
  setOnline: (v: boolean) => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (v) => set({ isOnline: v }),
}));

/** Хук для проверки оффлайн-режима. Используй в формах: disabled={isOffline} */
export function useNetworkStatus(): boolean {
  return useNetworkStore((s) => !s.isOnline);
}

export default function NetworkStatus() {
  const [mounted, setMounted] = useState(false);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const setOnline = useNetworkStore((s) => s.setOnline);

  useEffect(() => {
    setMounted(true);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [setOnline]);

  if (!mounted || isOnline) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-amber-500 text-amber-950 py-2 px-4 text-center text-sm font-medium shadow-lg"
      role="status"
      aria-live="polite"
    >
      ⚠️ Offline Mode. Shown: cached data. Changes disabled.
    </div>
  );
}
