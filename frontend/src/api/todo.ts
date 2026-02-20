import api from './client';
import { Project, WorkItem, ChecklistItem, ApiResponse } from '../types';

export const todoApi = {
  // Projects
  getProjects: async (params?: {
    workspace_id?: number;
    page?: number;
    search?: string;
    status?: string;
  }): Promise<ApiResponse<Project>> => {
    const response = await api.get('/todo/projects/', { params });
    return response.data;
  },

  getProject: async (id: number): Promise<Project> => {
    const response = await api.get(`/todo/projects/${id}/`);
    return response.data;
  },

  createProject: async (data: Partial<Project> | FormData): Promise<Project> => {
    const response = data instanceof FormData
      ? await api.post('/todo/projects/', data)
      : await api.post('/todo/projects/', data);
    return response.data;
  },

  updateProject: async (id: number, data: Partial<Project> | FormData): Promise<Project> => {
    const response = data instanceof FormData
      ? await api.patch(`/todo/projects/${id}/`, data)
      : await api.patch(`/todo/projects/${id}/`, data);
    return response.data;
  },

  deleteProject: async (id: number): Promise<void> => {
    await api.delete(`/todo/projects/${id}/`);
  },

  // Tasks (WorkItems)
  getTasks: async (params?: {
    project?: number;
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    assigned_to?: number;
  }): Promise<ApiResponse<WorkItem>> => {
    const response = await api.get('/todo/tasks/', { params });
    return response.data;
  },

  getTask: async (id: number): Promise<WorkItem> => {
    const response = await api.get(`/todo/tasks/${id}/`);
    return response.data;
  },

  createTask: async (data: Partial<WorkItem>): Promise<WorkItem> => {
    const response = await api.post('/todo/tasks/', data);
    return response.data;
  },

  updateTask: async (id: number, data: Partial<WorkItem>): Promise<WorkItem> => {
    const response = await api.patch(`/todo/tasks/${id}/`, data);
    return response.data;
  },

  deleteTask: async (id: number): Promise<void> => {
    await api.delete(`/todo/tasks/${id}/`);
  },

  completeTask: async (id: number): Promise<WorkItem> => {
    const response = await api.post(`/todo/tasks/${id}/complete/`);
    return response.data;
  },

  cancelTask: async (id: number): Promise<WorkItem> => {
    const response = await api.post(`/todo/tasks/${id}/cancel/`);
    return response.data;
  },

  // Checklist (подзадачи)
  getChecklistItems: async (workitemId: number): Promise<ChecklistItem[]> => {
    const response = await api.get('/todo/checklist-items/', { params: { workitem_id: workitemId } });
    return response.data.results ?? response.data;
  },
  createChecklistItem: async (data: { workitem: number; title: string; sort_order?: number }): Promise<ChecklistItem> => {
    const response = await api.post('/todo/checklist-items/', data);
    return response.data;
  },
  updateChecklistItem: async (id: number, data: Partial<ChecklistItem>): Promise<ChecklistItem> => {
    const response = await api.patch(`/todo/checklist-items/${id}/`, data);
    return response.data;
  },
  deleteChecklistItem: async (id: number): Promise<void> => {
    await api.delete(`/todo/checklist-items/${id}/`);
  },
};
