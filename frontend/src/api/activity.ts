import api from './client';
import { ActivityLog, ApiResponse } from '../types';

export const activityApi = {
  /** Последняя активность по всем проектам пользователя (для дашборда). */
  getRecentActivity: async (limit = 15): Promise<ApiResponse<ActivityLog>> => {
    const response = await api.get('/notifications/activity/', { params: { limit } });
    return response.data;
  },
  /** Журнал активности по проекту (проект + его задачи). */
  getProjectActivity: async (projectId: number): Promise<ApiResponse<ActivityLog>> => {
    const response = await api.get('/notifications/activity/', {
      params: { project_id: projectId },
    });
    return response.data;
  },
  /** Журнал активности по задаче. */
  getTaskActivity: async (workitemId: number): Promise<ApiResponse<ActivityLog>> => {
    const response = await api.get('/notifications/activity/', {
      params: { workitem_id: workitemId },
    });
    return response.data;
  },
};
