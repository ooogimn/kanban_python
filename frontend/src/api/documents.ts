import api from './client';
import { Attachment, Comment, WikiPage, WorkItem, ApiResponse } from '../types';

export const documentsApi = {
  // Attachments (Files)
  /**
   * Загрузка файла
   * @param entityType - тип сущности: 'project' | 'workitem' | 'card' | 'schedule'
   * @param entityId - ID сущности
   * @param file - файл для загрузки
   * @param isPublic - публичный доступ (для Google Docs viewer)
   * @param onProgress - callback для отслеживания прогресса
   */
  uploadFile: async (
    entityType: 'project' | 'workitem' | 'card' | 'schedule',
    entityId: number,
    file: File,
    isPublic: boolean = false,
    onProgress?: (progress: number) => void
  ): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId.toString());
    formData.append('is_public', isPublic.toString());

    const response = await api.post('/documents/attachments/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  },

  /**
   * Получение списка файлов
   */
  getFiles: async (params?: {
    project?: number;
    entity_type?: string;
    entity_id?: number;
    file_type?: string;
    search?: string;
  }): Promise<ApiResponse<Attachment>> => {
    const response = await api.get('/documents/attachments/', { params });
    return response.data;
  },

  /**
   * Получение деталей файла
   */
  getFile: async (id: number): Promise<Attachment> => {
    const response = await api.get(`/documents/attachments/${id}/`);
    return response.data;
  },

  /**
   * Скачивание файла
   */
  downloadFile: async (id: number): Promise<Blob> => {
    const response = await api.get(`/documents/attachments/${id}/download/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Получение URL для просмотра файла
   */
  getPreviewUrl: (id: number): string => {
    return `/api/v1/documents/attachments/${id}/preview/`;
  },

  /**
   * Получение URL для Google Docs/Sheets viewer
   */
  getGooglePreviewUrl: async (id: number): Promise<string | null> => {
    try {
      const attachment = await documentsApi.getFile(id);
      return attachment.google_preview_url || null;
    } catch (error) {
      console.error('Error getting Google preview URL:', error);
      return null;
    }
  },

  /**
   * Удаление файла
   */
  deleteFile: async (id: number): Promise<void> => {
    await api.delete(`/documents/attachments/${id}/`);
  },

  // Comments
  /**
   * Получение комментариев для сущности
   */
  getComments: async (
    entityType: 'workitem' | 'attachment' | 'project',
    entityId: number
  ): Promise<Comment[]> => {
    const response = await api.get('/documents/comments/', {
      params: {
        entity_type: entityType,
        entity_id: entityId,
      },
    });
    return response.data.results || response.data;
  },

  /**
   * Создание комментария
   */
  createComment: async (
    entityType: 'workitem' | 'attachment' | 'project',
    entityId: number,
    content: string,
    parentId?: number
  ): Promise<Comment> => {
    const data: any = {
      entity_type: entityType,
      entity_id: entityId,
      content,
    };
    if (parentId) {
      data.parent_id = parentId;
    }
    const response = await api.post('/documents/comments/', data);
    return response.data;
  },

  /**
   * Обновление комментария
   */
  updateComment: async (id: number, content: string): Promise<Comment> => {
    const response = await api.put(`/documents/comments/${id}/`, { content });
    return response.data;
  },

  /**
   * Удаление комментария
   */
  deleteComment: async (id: number): Promise<void> => {
    await api.delete(`/documents/comments/${id}/`);
  },

  /**
   * Создать задачу из комментария
   */
  createTaskFromComment: async (commentId: number): Promise<WorkItem> => {
    const response = await api.post(
      `/documents/comments/${commentId}/create-task/`
    );
    return response.data;
  },

  // Wiki Pages
  /**
   * Получение списка Wiki страниц (записок).
   * scope=personal — только личные (без проекта/воркспейса).
   * При workitem_id workspace_id не передаётся, чтобы бэкенд вернул все заметки задачи (личные и рабочие).
   */
  getWikiPages: async (params?: {
    workspace_id?: number;
    project_id?: number;
    author?: number;
    workitem_id?: number;
    scope?: 'personal';
    search?: string;
  }): Promise<ApiResponse<WikiPage>> => {
    let requestParams = params ?? {};
    if (requestParams.workitem_id != null) {
      const { workspace_id: _w, ...rest } = requestParams;
      requestParams = rest;
    }
    const response = await api.get('/documents/wiki/pages/', { params: requestParams });
    return response.data;
  },

  /**
   * Получение деталей Wiki страницы
   */
  getWikiPage: async (id: number): Promise<WikiPage> => {
    const response = await api.get(`/documents/wiki/pages/${id}/`);
    return response.data;
  },

  /**
   * Создание Wiki страницы
   */
  createWikiPage: async (data: Partial<WikiPage>): Promise<WikiPage> => {
    const response = await api.post('/documents/wiki/pages/', data);
    return response.data;
  },

  /**
   * Обновление Wiki страницы (полное)
   */
  updateWikiPage: async (
    id: number,
    data: Partial<WikiPage>
  ): Promise<WikiPage> => {
    const response = await api.put(`/documents/wiki/pages/${id}/`, data);
    return response.data;
  },

  /**
   * Частичное обновление (для привязки к задаче/проекту)
   */
  patchWikiPage: async (
    id: number,
    data: Partial<WikiPage>
  ): Promise<WikiPage> => {
    const response = await api.patch(`/documents/wiki/pages/${id}/`, data);
    return response.data;
  },

  /**
   * Удаление Wiki страницы
   */
  deleteWikiPage: async (id: number): Promise<void> => {
    await api.delete(`/documents/wiki/pages/${id}/`);
  },

  /**
   * Получение дерева Wiki страниц проекта
   */
  getWikiTree: async (projectId: number): Promise<WikiPage[]> => {
    const response = await api.get(
      `/documents/wiki/pages/projects/${projectId}/tree/`
    );
    return response.data;
  },

  /**
   * Дерево личных заметок (без воркспейса/проекта)
   */
  getWikiTreePersonal: async (): Promise<WikiPage[]> => {
    const response = await api.get('/documents/wiki/pages/personal/tree/');
    return response.data;
  },

  /**
   * Создать задачу из записи (Wiki-страницы)
   */
  createTaskFromWikiPage: async (wikiPageId: number): Promise<WorkItem> => {
    const response = await api.post(
      `/documents/wiki/pages/${wikiPageId}/create-task/`
    );
    return response.data;
  },
};
