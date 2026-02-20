/**
 * QueryClient с настройками для Offline-First (Task 3.3).
 *
 * - gcTime: 24ч — данные в памяти/IDB живут сутки
 * - staleTime: 5мин — данные считаются свежими, не требуют refetch
 * - retry: 1 — в оффлайне не спамить сервер
 */
import { QueryClient } from '@tanstack/react-query';

const ONE_HOUR_MS = 1000 * 60 * 60;
const FIVE_MINUTES_MS = 1000 * 60 * 5;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      gcTime: ONE_HOUR_MS * 24, // 24 часа
      staleTime: FIVE_MINUTES_MS, // 5 минут
    },
  },
});
