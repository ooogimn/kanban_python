import api from './client';
import { Workspace, ApiResponse } from '../types';

export const workspaceApi = {
  getWorkspaces: async (): Promise<ApiResponse<Workspace>> => {
    const response = await api.get('/core/workspaces/');
    return response.data;
  },

  /** Текущий (первый) workspace пользователя. При 404 — первый из списка (восстановление доступа). */
  getCurrentWorkspace: async (): Promise<Workspace | null> => {
    try {
      const response = await api.get<Workspace>('/core/workspaces/current/');
      return response.data;
    } catch {
      try {
        const list = await workspaceApi.getWorkspaces();
        return list?.results?.[0] ?? null;
      } catch {
        return null;
      }
    }
  },

  getWorkspace: async (id: number): Promise<Workspace> => {
    const response = await api.get(`/core/workspaces/${id}/`);
    return response.data;
  },

  createWorkspace: async (data: Partial<Workspace> | FormData): Promise<Workspace> => {
    const response = data instanceof FormData
      ? await api.post('/core/workspaces/', data)
      : await api.post('/core/workspaces/', data);
    return response.data;
  },

  updateWorkspace: async (id: number, data: Partial<Workspace> | FormData): Promise<Workspace> => {
    const response = data instanceof FormData
      ? await api.patch(`/core/workspaces/${id}/`, data)
      : await api.patch(`/core/workspaces/${id}/`, data);
    return response.data;
  },

  deleteWorkspace: async (id: number): Promise<void> => {
    await api.delete(`/core/workspaces/${id}/`);
  },

  getWorkspaceMembers: async (id: number) => {
    const response = await api.get(`/core/workspaces/${id}/members/`);
    return response.data;
  },

  getWorkspaceProjects: async (id: number) => {
    const response = await api.get(`/core/workspaces/${id}/projects/`);
    return response.data;
  },
};
