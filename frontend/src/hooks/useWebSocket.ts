import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/** Базовый URL для WebSocket. В dev с proxy — тот же origin (Vite проксирует /ws на бекенд). */
function getWsBase(): string {
  const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
  if (!apiUrl.startsWith('http')) {
    // Относительный API (например /api/v1) — WebSocket с того же origin, прокси Vite перешлёт на бекенд
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    }
    return 'ws://localhost:3000';
  }
  const base = apiUrl.replace(/\/api\/v1\/?$/, '') || 'http://localhost:8000';
  return base.replace(/^http/, 'ws');
}

export type WebSocketMessage = { type: string; data?: unknown };

const RECONNECT_DELAY_MS = 3000;

/**
 * Подключение к WebSocket с JWT в query. При получении сообщений инвалидирует указанные query keys.
 * При разрыве соединения автоматически переподключается через RECONNECT_DELAY_MS.
 */
export function useWebSocket(
  path: string | null,
  invalidateKeys: unknown[][] = [],
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const token = apiClient.getToken();
  const keysRef = useRef(invalidateKeys);
  keysRef.current = invalidateKeys;

  useEffect(() => {
    if (!path || !enabled || !token) {
      setReadyState(WebSocket.CLOSED);
      return;
    }

    const base = getWsBase();
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setReadyState(WebSocket.OPEN);
    ws.onclose = () => {
      setReadyState(WebSocket.CLOSED);
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(
        () => setReconnectTrigger((n) => n + 1),
        RECONNECT_DELAY_MS
      );
    };
    ws.onerror = () => { };
    ws.onmessage = (event) => {
      try {
        JSON.parse(event.data);
        const keys = keysRef.current;
        keys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
      } catch {
        // ignore
      }
    };

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      ws.close();
      wsRef.current = null;
      setReadyState(WebSocket.CLOSED);
    };
  }, [path, enabled, token, queryClient, reconnectTrigger]);

  return { readyState };
}

/** Подписка на дашборд: обновление статистики и списков при изменениях. */
export function useDashboardWebSocket() {
  useWebSocket('/ws/dashboard/', [['dashboard-stats'], ['workspaces'], ['projects'], ['tasks-dashboard']], {
    enabled: !!apiClient.getToken(),
  });
}

/** Подписка на канбан-доску: обновление при перемещении/создании карточек. */
export function useKanbanWebSocket(boardId: number | string | null) {
  const path = boardId ? `/ws/kanban/${boardId}/` : null;
  useWebSocket(path, [['kanban-board-full', String(boardId)]], {
    enabled: !!boardId && !!apiClient.getToken(),
  });
}

/** Подписка на проект: обновление задач и активности. */
export function useProjectWebSocket(projectId: number | null) {
  const path = projectId ? `/ws/project/${projectId}/` : null;
  useWebSocket(path, [['project', projectId!], ['tasks', { project: projectId }], ['activity', projectId!]], {
    enabled: !!projectId && !!apiClient.getToken(),
  });
}
