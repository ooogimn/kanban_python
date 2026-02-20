import api from './client';
import { CalendarEvent, ApiResponse } from '../types';

export const calendarApi = {
  getEvents: async (params?: { start?: string; end?: string }): Promise<ApiResponse<CalendarEvent>> => {
    const response = await api.get('/calendar/events/', { params });
    return response.data;
  },

  getEvent: async (id: number): Promise<CalendarEvent> => {
    const response = await api.get(`/calendar/events/${id}/`);
    return response.data;
  },

  createEvent: async (data: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const response = await api.post('/calendar/events/', data);
    return response.data;
  },

  updateEvent: async (id: number, data: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const response = await api.patch(`/calendar/events/${id}/`, data);
    return response.data;
  },

  deleteEvent: async (id: number): Promise<void> => {
    await api.delete(`/calendar/events/${id}/`);
  },

  getEventsRange: async (start: string, end: string, projectId?: number): Promise<ApiResponse<CalendarEvent>> => {
    const params: { start: string; end: string; project?: number } = { start, end };
    if (projectId) params.project = projectId;
    const response = await api.get('/calendar/events/range/', { params });
    return response.data;
  },

  /** Calendar 2.0: объединённый feed событий + задач с датами */
  getFeed: async (
    start: string,
    end: string,
    options?: { projectId?: number; workspaceId?: number }
  ): Promise<CalendarFeedItem[]> => {
    const params: { start: string; end: string; project?: number; workspace_id?: number } = { start, end };
    if (options?.projectId) params.project = options.projectId;
    if (options?.workspaceId) params.workspace_id = options.workspaceId;
    const response = await api.get<CalendarFeedItem[]>('/calendar/events/feed/', { params });
    return Array.isArray(response.data) ? response.data : [];
  },
};

export interface CalendarFeedItem {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  is_task: boolean;
  workitem_id: number | null;
  event_id: number | null;
  allDay: boolean;
}
