import api from './client';

export interface MindMapDto {
  id: number;
  title: string;
  owner: number;
  workspace: number | null;
  project: number | null;
  related_workitem: number | null;
  nodes: unknown[];
  edges: unknown[];
  is_personal: boolean;
  created_at: string;
  updated_at: string;
}

export const mindmapsApi = {
  getList: async (params?: {
    project_id?: number;
    related_workitem_id?: number;
    workspace_id?: number;
    is_personal?: boolean;
  }): Promise<MindMapDto[]> => {
    const query: Record<string, string | number | boolean> = {};
    if (params?.project_id != null) query.project = params.project_id;
    if (params?.related_workitem_id != null) query.related_workitem = params.related_workitem_id;
    if (params?.workspace_id != null) query.workspace = params.workspace_id;
    if (params?.is_personal != null) query.is_personal = params.is_personal;
    const response = await api.get('/mindmaps/maps/', { params: query });
    return Array.isArray(response.data?.results) ? response.data.results : response.data ?? [];
  },

  getOne: async (id: number): Promise<MindMapDto> => {
    const response = await api.get(`/mindmaps/maps/${id}/`);
    return response.data;
  },

  create: async (data: Partial<MindMapDto>): Promise<MindMapDto> => {
    const response = await api.post('/mindmaps/maps/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<MindMapDto>): Promise<MindMapDto> => {
    const response = await api.patch(`/mindmaps/maps/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/mindmaps/maps/${id}/`);
  },
};
