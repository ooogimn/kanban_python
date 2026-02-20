/**
 * Persister для TanStack Query → IndexedDB (Task 3.3 Offline-First).
 *
 * Использует createAsyncStoragePersister (не sync!) — IndexedDB асинхронна.
 * Адаптер для idb-keyval: get/set/del → getItem/setItem/removeItem.
 */
import { get, set, del } from 'idb-keyval';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';

const DEFAULT_KEY = 'reactQuery';

/**
 * Создаёт персистер для сохранения кэша TanStack Query в IndexedDB.
 *
 * @param idbValidKey — ключ в IndexedDB для хранения dehydrated state
 */
export function createIDBPersister(idbValidKey: string = DEFAULT_KEY): Persister {
  return createAsyncStoragePersister({
    storage: {
      getItem: async (key: string) => {
        try {
          const val = await get(key);
          return val ?? null;
        } catch {
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await set(key, value);
        } catch {
          // IndexedDB недоступен (например, в некоторых контекстах Tauri)
        }
      },
      removeItem: async (key: string) => {
        try {
          await del(key);
        } catch {
          // ignore
        }
      },
    },
    key: idbValidKey,
  });
}
