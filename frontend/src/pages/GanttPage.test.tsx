import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GanttPage from './GanttPage';
import { ganttApi } from '../api/gantt';
import { todoApi } from '../api/todo';

vi.mock('../api/gantt');
vi.mock('../api/todo');
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGetProjects = vi.mocked(todoApi.getProjects);
const mockGetProjectTasks = vi.mocked(ganttApi.getProjectTasks);
const mockUpdateGanttTask = vi.mocked(ganttApi.updateGanttTask);
const mockCreateDependency = vi.mocked(ganttApi.createDependency);
const mockDeleteDependency = vi.mocked(ganttApi.deleteDependency);

const ganttData = {
  project_id: 1,
  project_name: 'Тестовый проект',
  tasks: [
    {
      id: 1,
      name: 'Задача один',
      start_date: '2025-01-01',
      end_date: '2025-01-10',
      progress: 0,
      related_workitem: 10,
      parent: null,
      created_at: '',
      updated_at: '',
    },
  ],
  dependencies: [],
};

function renderGanttPage(route = '/gantt/1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/gantt/:id?" element={<GanttPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GanttPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjects.mockResolvedValue({
      results: [{ id: 1, name: 'Проект 1' } as any],
      count: 1,
      next: undefined,
      previous: undefined,
    });
    mockGetProjectTasks.mockResolvedValue(ganttData);
    mockUpdateGanttTask.mockResolvedValue(ganttData.tasks[0] as any);
    mockCreateDependency.mockResolvedValue({
      id: 1,
      predecessor: 1,
      successor: 2,
      type: 'FS',
      lag: 0,
      created_at: '',
    } as any);
    mockDeleteDependency.mockResolvedValue(undefined);
  });

  it('отображает заголовок и подпись', async () => {
    renderGanttPage();
    await waitFor(() => {
      expect(screen.getByText('Диаграмма Ганта')).toBeInTheDocument();
    });
    expect(screen.getByText(/Временная шкала задач по проекту/)).toBeInTheDocument();
  });

  it('при отсутствии проектов показывает сообщение и ссылку на проекты', async () => {
    mockGetProjects.mockResolvedValue({ results: [], count: 0, next: undefined, previous: undefined });
    renderGanttPage('/gantt');
    await waitFor(() => {
      expect(screen.getByText(/Нет проектов/)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Перейти к проектам/ })).toBeInTheDocument();
  });

  it('загружает данные Ганта и отображает название проекта в диаграмме', async () => {
    renderGanttPage();
    expect(screen.getByText(/Загрузка диаграммы/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Тестовый проект')).toBeInTheDocument();
    });
    expect(screen.getByText('Задача один')).toBeInTheDocument();
    expect(mockGetProjectTasks).toHaveBeenCalledWith(1);
  });

  it('при перетаскивании полоски вызывает updateGanttTask и обновляет кэш (оптимистично)', async () => {
    renderGanttPage();
    await waitFor(() => {
      expect(screen.getByText('Задача один')).toBeInTheDocument();
    });
    const bars = screen.getAllByRole('button', { name: /Перетащите для сдвига/ });
    fireEvent.mouseDown(bars[0], { clientX: 100 });
    fireEvent.mouseUp(window);
    await waitFor(() => {
      expect(mockUpdateGanttTask).toHaveBeenCalledWith(1, {
        start_date: '2025-01-01',
        end_date: '2025-01-10',
      });
    });
  });

  it('при добавлении зависимости вызывает createDependency', async () => {
    mockGetProjectTasks.mockResolvedValue({
      ...ganttData,
      tasks: [
        ganttData.tasks[0],
        {
          id: 2,
          name: 'Задача два',
          start_date: '2025-01-05',
          end_date: '2025-01-15',
          progress: 0,
          related_workitem: 20,
          parent: null,
          created_at: '',
          updated_at: '',
        },
      ],
    });
    renderGanttPage();
    await waitFor(() => {
      expect(screen.getByText('Добавить связь:')).toBeInTheDocument();
    });
    const [pred, succ] = screen.getAllByRole('combobox');
    fireEvent.change(pred, { target: { value: '1' } });
    fireEvent.change(succ, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() => {
      expect(mockCreateDependency).toHaveBeenCalledWith(1, 2);
    });
  });

  it('при удалении зависимости вызывает deleteDependency', async () => {
    mockGetProjectTasks.mockResolvedValue({
      ...ganttData,
      dependencies: [
        { id: 100, predecessor: 1, successor: 2, type: 'FS' as const, lag: 0, created_at: '' },
      ],
    });
    renderGanttPage();
    await waitFor(() => {
      expect(screen.getByTitle('Удалить зависимость')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Удалить зависимость'));
    await waitFor(() => {
      expect(mockDeleteDependency).toHaveBeenCalledWith(100);
    });
  });
});
