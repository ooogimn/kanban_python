import api from './client';
import { Board, Column, KanbanItem, ApiResponse } from '../types';

/**
 * Тип ответа getBoardFull: доска с колонками и задачами проекта не на этой доске (есть на Ганте).
 */
export type BoardFull = Board & {
  columns: (Column & { items?: KanbanItem[] })[];
  /** Задачи проекта, которые не в колонках этой доски — показываем отдельной колонкой «Другие задачи проекта». */
  unplaced_items?: KanbanItem[];
};

export const kanbanApi = {
  // ========== Boards ==========

  /** Список досок. Фильтры: workspace_id — пространство, project — проект. */
  getBoards: async (params?: { workspace_id?: number; project?: number }): Promise<ApiResponse<Board>> => {
    const requestParams: { workspace_id?: number; project_id?: number } = {};
    if (params?.workspace_id != null) requestParams.workspace_id = params.workspace_id;
    if (params?.project != null) requestParams.project_id = params.project;
    const response = await api.get('/kanban/boards/', { params: requestParams });
    return response.data;
  },

  getBoard: async (id: number): Promise<Board> => {
    const response = await api.get(`/kanban/boards/${id}/`);
    return response.data;
  },

  /**
   * Получение доски со всеми колонками и задачами (items).
   * Эндпоинт: GET /kanban/boards/{id}/full/
   */
  getBoardFull: async (id: number): Promise<BoardFull> => {
    const response = await api.get(`/kanban/boards/${id}/full/`);
    return response.data;
  },

  createBoard: async (data: Partial<Board>): Promise<Board> => {
    const response = await api.post('/kanban/boards/', data);
    return response.data;
  },

  updateBoard: async (id: number, data: Partial<Board>): Promise<Board> => {
    const response = await api.patch(`/kanban/boards/${id}/`, data);
    return response.data;
  },

  deleteBoard: async (id: number): Promise<void> => {
    await api.delete(`/kanban/boards/${id}/`);
  },

  // ========== Columns ==========

  getColumns: async (params?: { board?: number }): Promise<ApiResponse<Column>> => {
    const response = await api.get('/kanban/columns/', { params });
    return response.data;
  },

  createColumn: async (data: { board: number; name: string; position: number }): Promise<Column> => {
    const response = await api.post('/kanban/columns/', data);
    return response.data;
  },

  updateColumn: async (id: number, data: Partial<Column>): Promise<Column> => {
    const response = await api.patch(`/kanban/columns/${id}/`, data);
    return response.data;
  },

  deleteColumn: async (id: number): Promise<void> => {
    await api.delete(`/kanban/columns/${id}/`);
  },

  // ========== Tasks (WorkItem) ==========

  /**
   * Перемещение задачи (WorkItem) между колонками.
   * Эндпоинт: POST /kanban/columns/move-task/
   * 
   * @param workitemId - ID задачи (WorkItem)
   * @param targetColumnId - ID целевой колонки
   * @param newOrder - позиция в колонке (sort_order)
   */
  moveTask: async (
    workitemId: number,
    targetColumnId: number,
    newOrder: number
  ): Promise<KanbanItem> => {
    const response = await api.post('/kanban/columns/move-task/', {
      workitem_id: workitemId,
      target_column_id: targetColumnId,
      new_order: newOrder,
    });
    return response.data;
  },
};
