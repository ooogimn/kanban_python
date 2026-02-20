import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GanttChart from './GanttChart';
import type { GanttTask, GanttDependency } from '../../types';

const mockTasks: GanttTask[] = [
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
  {
    id: 2,
    name: 'Задача два',
    start_date: '2025-01-05',
    end_date: '2025-01-15',
    progress: 50,
    related_workitem: 20,
    parent: null,
    created_at: '',
    updated_at: '',
  },
];

const mockDependencies: GanttDependency[] = [
  {
    id: 100,
    predecessor: 1,
    predecessor_name: 'Задача один',
    successor: 2,
    successor_name: 'Задача два',
    type: 'FS',
    lag: 0,
    created_at: '',
  },
];

describe('GanttChart', () => {
  it('отображает пустое состояние при отсутствии задач', () => {
    render(
      <GanttChart
        tasks={[]}
        dependencies={[]}
        projectName="Проект"
        projectId={1}
      />
    );
    expect(screen.getByText(/Нет задач с датами для отображения/)).toBeInTheDocument();
  });

  it('отображает название проекта и полоски задач', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        dependencies={[]}
        projectName="Мой проект"
        projectId={1}
      />
    );
    expect(screen.getByText('Мой проект')).toBeInTheDocument();
    expect(screen.getByText('Задача один')).toBeInTheDocument();
    expect(screen.getByText('Задача два')).toBeInTheDocument();
  });

  it('отображает список зависимостей', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        dependencies={mockDependencies}
        projectName="Проект"
        projectId={1}
      />
    );
    expect(screen.getByText(/Зависимости \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Задача один → Задача два/)).toBeInTheDocument();
  });

  it('при перетаскивании полоски вызывает onTaskUpdate при отпускании', () => {
    const onTaskUpdate = vi.fn();
    render(
      <GanttChart
        tasks={mockTasks}
        dependencies={[]}
        projectName="Проект"
        projectId={1}
        onTaskUpdate={onTaskUpdate}
      />
    );
    const bars = screen.getAllByRole('button', { name: /Перетащите для сдвига/ });
    const firstBar = bars[0];
    fireEvent.mouseDown(firstBar, { clientX: 100 });
    fireEvent.mouseUp(window);
    expect(onTaskUpdate).toHaveBeenCalledTimes(1);
    expect(onTaskUpdate).toHaveBeenCalledWith(1, {
      start_date: '2025-01-01',
      end_date: '2025-01-10',
    });
  });

  it('отображает форму добавления зависимости при onDependencyCreate и 2+ задачах', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        dependencies={[]}
        projectName="Проект"
        projectId={1}
        onDependencyCreate={vi.fn()}
      />
    );
    expect(screen.getByText('Добавить связь:')).toBeInTheDocument();
    const combos = screen.getAllByRole('combobox');
    expect(combos.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
  });

  it('при нажатии «Добавить» вызывает onDependencyCreate с выбранными id', async () => {
    const onDependencyCreate = vi.fn();
    render(
      <GanttChart
        tasks={mockTasks}
        dependencies={[]}
        projectName="Проект"
        projectId={1}
        onDependencyCreate={onDependencyCreate}
      />
    );
    const [predSelect, succSelect] = screen.getAllByRole('combobox');
    fireEvent.change(predSelect, { target: { value: '1' } });
    fireEvent.change(succSelect, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(onDependencyCreate).toHaveBeenCalledWith(1, 2);
  });

  it('отображает кнопку удаления зависимости при onDependencyDelete', () => {
    const onDependencyDelete = vi.fn();
    render(
      <GanttChart
        tasks={mockTasks}
        dependencies={mockDependencies}
        projectName="Проект"
        projectId={1}
        onDependencyDelete={onDependencyDelete}
      />
    );
    const deleteBtn = screen.getByTitle('Удалить зависимость');
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn);
    expect(onDependencyDelete).toHaveBeenCalledWith(100);
  });

  it('показывает оверлей «Сохранение...» при isUpdating', () => {
    render(
      <GanttChart
        tasks={mockTasks}
        dependencies={[]}
        projectName="Проект"
        projectId={1}
        isUpdating
      />
    );
    expect(screen.getByText('Сохранение...')).toBeInTheDocument();
  });
});
