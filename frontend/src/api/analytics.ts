import api from './client';
import { DashboardStats, ProjectMetrics, DashboardOverview } from '../types';

function downloadBlob(blob: Blob, defaultName: string, contentDisposition?: string) {
  let filename = defaultName;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    if (match) filename = match[1].trim();
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export const analyticsApi = {
  /** Сводка главного дашборда: задачи, встречи, бюджет, активный таймер */
  getDashboardOverview: async (): Promise<DashboardOverview> => {
    const response = await api.get('/analytics/dashboard/overview/');
    return response.data;
  },

  getDashboardStats: async (workspaceId: number): Promise<DashboardStats> => {
    const response = await api.get(`/analytics/dashboard-stats/${workspaceId}/`);
    return response.data;
  },

  /** Данные для графиков дашборда (finance_flow, project_hours, team_load) */
  getDashboardCharts: async (): Promise<DashboardChartsData> => {
    const response = await api.get('/core/dashboard-stats/');
    return response.data;
  },

  getProjectMetrics: async (projectId: number): Promise<ProjectMetrics> => {
    const response = await api.get(`/analytics/project-metrics/${projectId}/`);
    return response.data;
  },

  getUserWorkload: async (userId: number): Promise<any> => {
    const response = await api.get(`/analytics/user-workload/${userId}/`);
    return response.data;
  },

  /** Скачать задачи в CSV (по workspace или по проекту). */
  exportTasksCsv: async (params: { workspace_id?: number; project_id?: number }): Promise<void> => {
    const search = new URLSearchParams();
    if (params.workspace_id != null) search.set('workspace_id', String(params.workspace_id));
    if (params.project_id != null) search.set('project_id', String(params.project_id));
    const response = await api.get(`/analytics/export/tasks/?${search.toString()}`, {
      responseType: 'blob',
    });
    const disposition = (response.headers as Record<string, string>)['content-disposition'];
    downloadBlob(
      response.data as Blob,
      `tasks_${params.project_id ?? params.workspace_id ?? 'export'}.csv`,
      disposition
    );
  },

  /** Скачать проекты в CSV по workspace. */
  exportProjectsCsv: async (workspaceId: number): Promise<void> => {
    const response = await api.get(`/analytics/export/projects/?workspace_id=${workspaceId}`, {
      responseType: 'blob',
    });
    const disposition = (response.headers as Record<string, string>)['content-disposition'];
    downloadBlob(response.data as Blob, `projects_${workspaceId}.csv`, disposition);
  },
};
