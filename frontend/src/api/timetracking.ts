import api from './client';

// Types
export interface TimeLogUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
}

export interface TimeLog {
  id: number;
  workitem: number;
  workitem_title: string;
  user: TimeLogUser;
  started_at: string;
  stopped_at: string | null;
  duration_minutes: number | null;
  description: string;
  billable: boolean;
  is_running: boolean;
  elapsed_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface ActiveTimerResponse {
  active: TimeLog | null;
  is_running?: boolean;
}

export interface TimeSummary {
  total_minutes: number;
  total_hours: number;
  logs_count: number;
}

export interface ApiResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Timetracking API
export const timetrackingApi = {
  /**
   * Получить список логов времени
   */
  getLogs: async (params?: {
    workitem?: number;
    user?: number;
    page?: number;
  }): Promise<ApiResponse<TimeLog>> => {
    const response = await api.get('/timetracking/logs/', { params });
    return response.data;
  },

  /**
   * Получить конкретный лог
   */
  getLog: async (id: number): Promise<TimeLog> => {
    const response = await api.get(`/timetracking/logs/${id}/`);
    return response.data;
  },

  /**
   * Запустить таймер для задачи
   */
  startTimer: async (
    workitemId: number,
    options?: { description?: string; billable?: boolean }
  ): Promise<TimeLog> => {
    const response = await api.post('/timetracking/logs/start/', {
      workitem_id: workitemId,
      description: options?.description || '',
      billable: options?.billable ?? true,
    });
    return response.data;
  },

  /**
   * Остановить активный таймер
   */
  stopTimer: async (description?: string): Promise<TimeLog> => {
    const response = await api.post('/timetracking/logs/stop/', {
      description,
    });
    return response.data;
  },

  /**
   * Получить активный таймер пользователя
   */
  getActiveTimer: async (): Promise<ActiveTimerResponse> => {
    const response = await api.get('/timetracking/logs/active/');
    return response.data;
  },

  /**
   * Проверить активный таймер для конкретной задачи
   */
  getActiveTimerForTask: async (workitemId: number): Promise<ActiveTimerResponse> => {
    const response = await api.get('/timetracking/logs/active_for_task/', {
      params: { workitem_id: workitemId },
    });
    return response.data;
  },

  /**
   * Получить суммарное время по задаче
   */
  getSummary: async (workitemId?: number): Promise<TimeSummary> => {
    const response = await api.get('/timetracking/logs/summary/', {
      params: workitemId ? { workitem_id: workitemId } : {},
    });
    return response.data;
  },

  /**
   * Удалить лог времени
   */
  deleteLog: async (id: number): Promise<void> => {
    await api.delete(`/timetracking/logs/${id}/`);
  },
};

export default timetrackingApi;
