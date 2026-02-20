import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ganttApi } from './gantt';

const mockApi = {
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
};

vi.mock('./client', () => ({ default: mockApi }));

describe('ganttApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjectTasks', () => {
    it('вызывает GET /gantt/projects/:id/tasks/ и возвращает данные', async () => {
      const projectId = 1;
      const data = {
        project_id: 1,
        project_name: 'Проект',
        tasks: [
          {
            id: 10,
            name: 'Задача',
            start_date: '2025-01-01',
            end_date: '2025-01-10',
            progress: 0,
            related_workitem: 100,
            parent: null,
            created_at: '',
            updated_at: '',
          },
        ],
        dependencies: [],
      };
      mockApi.get.mockResolvedValue({ data });

      const result = await ganttApi.getProjectTasks(projectId);

      expect(mockApi.get).toHaveBeenCalledWith(`/gantt/projects/${projectId}/tasks/`);
      expect(result).toEqual(data);
    });
  });

  describe('getGanttData', () => {
    it('вызывает GET /gantt/ с project_id и возвращает data + links', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          data: [{ id: 1, text: 'T', start_date: '2025-01-01', end_date: '2025-01-05', progress: 0, parent: 0 }],
          links: [{ id: 1, source: 1, target: 2, type: 1 }],
        },
      });

      const result = await ganttApi.getGanttData(2);

      expect(mockApi.get).toHaveBeenCalledWith('/gantt/', { params: { project_id: 2 } });
      expect(result.data).toHaveLength(1);
      expect(result.links).toHaveLength(1);
    });
  });

  describe('updateGanttTask', () => {
    it('вызывает PATCH /gantt/tasks/:id/ с датами и возвращает задачу', async () => {
      const taskId = 10;
      const payload = { start_date: '2025-01-02', end_date: '2025-01-12' };
      const updated = { id: taskId, name: 'Задача', ...payload, progress: 0, related_workitem: 100, parent: null, created_at: '', updated_at: '' };
      mockApi.patch.mockResolvedValue({ data: updated });

      const result = await ganttApi.updateGanttTask(taskId, payload);

      expect(mockApi.patch).toHaveBeenCalledWith(`/gantt/tasks/${taskId}/`, payload);
      expect(result.start_date).toBe('2025-01-02');
      expect(result.end_date).toBe('2025-01-12');
    });
  });

  describe('createDependency', () => {
    it('вызывает POST /gantt/dependencies/ с predecessor, successor, type', async () => {
      const dep = { id: 1, predecessor: 10, successor: 20, type: 'FS' as const, lag: 0, created_at: '' };
      mockApi.post.mockResolvedValue({ data: dep });

      const result = await ganttApi.createDependency(10, 20);

      expect(mockApi.post).toHaveBeenCalledWith('/gantt/dependencies/', {
        predecessor: 10,
        successor: 20,
        type: 'FS',
      });
      expect(result.id).toBe(1);
      expect(result.predecessor).toBe(10);
      expect(result.successor).toBe(20);
    });

    it('передаёт кастомный type при вызове', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 1, predecessor: 1, successor: 2, type: 'SS', lag: 0, created_at: '' } });
      await ganttApi.createDependency(1, 2, 'SS');
      expect(mockApi.post).toHaveBeenCalledWith('/gantt/dependencies/', {
        predecessor: 1,
        successor: 2,
        type: 'SS',
      });
    });
  });

  describe('deleteDependency', () => {
    it('вызывает DELETE /gantt/dependencies/:id/', async () => {
      mockApi.delete.mockResolvedValue({ status: 204 });

      await ganttApi.deleteDependency(5);

      expect(mockApi.delete).toHaveBeenCalledWith('/gantt/dependencies/5/');
    });
  });
});
