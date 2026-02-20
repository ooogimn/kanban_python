import api from './client';
import { ProjectMember } from '../types';

export interface CreateProjectMemberPayload {
  project: number;
  display_name?: string;
  role?: string;
  /** Теневой сотрудник — не передавать user. */
  user?: number | null;
  hourly_rate?: number | null;
  /** HR-SPRINT 3: привязка к контакту (приоритет над user). */
  contact_id?: number | null;
}

export const coreApi = {
  /**
   * Список участников проекта (в т.ч. теневых).
   * Обязательный параметр project_id.
   */
  getProjectMembers: async (projectId: number): Promise<ProjectMember[]> => {
    const response = await api.get<{ results?: ProjectMember[] } | ProjectMember[]>('/core/project-members/', {
      params: { project_id: projectId },
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  /**
   * Создать участника проекта (теневой — без user, только display_name и role).
   */
  createProjectMember: async (data: CreateProjectMemberPayload): Promise<ProjectMember> => {
    const response = await api.post<ProjectMember>('/core/project-members/', data);
    return response.data;
  },

  updateProjectMember: async (id: number, data: Partial<CreateProjectMemberPayload>): Promise<ProjectMember> => {
    const response = await api.patch<ProjectMember>(`/core/project-members/${id}/`, data);
    return response.data;
  },

  deleteProjectMember: async (id: number): Promise<void> => {
    await api.delete(`/core/project-members/${id}/`);
  },
};
