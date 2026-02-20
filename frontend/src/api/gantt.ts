import api from './client';
import { GanttProjectData, GanttTask, GanttDependency } from '../types';

/** Ответ GET /gantt/?project_id=X — формат data + links для визуализации */
export interface GanttDataResponse {
  data: Array<{ id: number; text: string; start_date: string; end_date: string; progress: number; parent: number }>;
  links: Array<{ id: number; source: number; target: number; type: number }>;
}

export const ganttApi = {
  /**
   * Получить задачи проекта для диаграммы Ганта (с зависимостями).
   * Фильтры: sprint_id (массив id или "null" для бэклога), user_id (ответственный), priority.
   */
  getProjectTasks: async (
    projectId: number,
    params?: { sprint_id?: number[] | 'null'; user_id?: number; priority?: string }
  ): Promise<GanttProjectData> => {
    const query: Record<string, string> = {};
    if (params?.sprint_id !== undefined) {
      query.sprint_id = Array.isArray(params.sprint_id)
        ? params.sprint_id.join(',')
        : params.sprint_id;
    }
    if (params?.user_id != null) query.user_id = String(params.user_id);
    if (params?.priority) query.priority = params.priority;
    const response = await api.get(`/gantt/projects/${projectId}/tasks/`, { params: query });
    return response.data;
  },

  /**
   * Получить данные в формате data + links (для DHTMLX-подобных библиотек).
   * Фильтры: sprint_id, user_id, priority (те же, что в getProjectTasks).
   */
  getGanttData: async (
    projectId: number,
    params?: { sprint_id?: number[] | 'null'; user_id?: number; priority?: string }
  ): Promise<GanttDataResponse> => {
    const query: Record<string, string> = { project_id: String(projectId) };
    if (params?.sprint_id !== undefined) {
      query.sprint_id = Array.isArray(params.sprint_id)
        ? params.sprint_id.join(',')
        : params.sprint_id;
    }
    if (params?.user_id != null) query.user_id = String(params.user_id);
    if (params?.priority) query.priority = params.priority ?? '';
    const response = await api.get('/gantt/', { params: query });
    return response.data;
  },

  /**
   * Обновить задачу Ганта (даты, прогресс). Синхронизируется с WorkItem на бэкенде.
   */
  updateGanttTask: async (
    id: number,
    data: Partial<Pick<GanttTask, 'start_date' | 'end_date' | 'progress' | 'name'>>
  ): Promise<GanttTask> => {
    const response = await api.patch(`/gantt/tasks/${id}/`, data);
    return response.data;
  },

  /**
   * Создать зависимость между задачами (predecessor → successor). type по умолчанию FS.
   */
  createDependency: async (
    predecessorId: number,
    successorId: number,
    type: 'FS' | 'SS' | 'FF' | 'SF' = 'FS'
  ): Promise<GanttDependency> => {
    const response = await api.post('/gantt/dependencies/', {
      predecessor: predecessorId,
      successor: successorId,
      type,
    });
    return response.data;
  },

  /**
   * Удалить зависимость.
   */
  deleteDependency: async (id: number): Promise<void> => {
    await api.delete(`/gantt/dependencies/${id}/`);
  },
};
