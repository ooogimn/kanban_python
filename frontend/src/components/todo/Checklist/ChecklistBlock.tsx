import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ChecklistItem } from '../../../types';
import { todoApi } from '../../../api/todo';

interface ChecklistBlockProps {
  workitemId: number;
  items: ChecklistItem[];
  checklistStats?: { total: number; done: number };
  onItemsChange?: (items: ChecklistItem[]) => void;
  invalidateKeys?: unknown[];
  readOnly?: boolean;
}

export default function ChecklistBlock({
  workitemId,
  items: initialItems,
  checklistStats,
  onItemsChange,
  invalidateKeys = [],
  readOnly = false,
}: ChecklistBlockProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ChecklistItem[]>(initialItems ?? []);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    setItems(initialItems ?? []);
  }, [initialItems?.length, workitemId]);

  const total = checklistStats?.total ?? items.length;
  const done = checklistStats?.done ?? items.filter((i) => i.is_done).length;

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_done }: { id: number; is_done: boolean }) =>
      todoApi.updateChecklistItem(id, { is_done }),
    onMutate: async ({ id, is_done }) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_done } : i)));
      onItemsChange?.(items.map((i) => (i.id === id ? { ...i, is_done } : i)));
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key as unknown[] }));
      queryClient.invalidateQueries({ queryKey: ['task', workitemId] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tasks' });
    },
    onError: () => {
      toast.error('Не удалось обновить подзадачу');
      queryClient.invalidateQueries({ queryKey: ['task', workitemId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      todoApi.createChecklistItem({
        workitem: workitemId,
        title,
        sort_order: items.length,
      }),
    onMutate: async (title) => {
      const temp: ChecklistItem = {
        id: -Date.now(),
        workitem: workitemId,
        title,
        is_done: false,
        sort_order: items.length,
      };
      setItems((prev) => [...prev, temp]);
      setNewTitle('');
    },
    onSuccess: (data) => {
      setItems((prev) => prev.map((i) => (i.id < 0 ? data : i)));
      onItemsChange?.([...items.filter((i) => i.id > 0), data]);
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key as unknown[] }));
      queryClient.invalidateQueries({ queryKey: ['task', workitemId] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tasks' });
    },
    onError: () => {
      toast.error('Не удалось добавить подзадачу');
      setItems((prev) => prev.filter((i) => i.id > 0));
      queryClient.invalidateQueries({ queryKey: ['task', workitemId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => todoApi.deleteChecklistItem(id),
    onMutate: (id) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key as unknown[] }));
      queryClient.invalidateQueries({ queryKey: ['task', workitemId] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tasks' });
    },
    onError: () => {
      toast.error('Не удалось удалить подзадачу');
      queryClient.invalidateQueries({ queryKey: ['task', workitemId] });
    },
  });

  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  return (
    <div className="space-y-3">
      {/* Список подзадач с чекбоксами — выше шкалы */}
      <ul className="space-y-1">
        {sortedItems.map((item) => (
          <li key={item.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={item.is_done}
              disabled={readOnly}
              onChange={() => {
                if (!readOnly) toggleMutation.mutate({ id: item.id, is_done: !item.is_done });
              }}
              className="rounded border-gray-300 dark:border-white/20 text-imperial-gold focus:ring-imperial-gold"
            />
            <span
              className={`flex-1 text-sm ${item.is_done
                  ? 'line-through text-slate-500 dark:text-slate-400'
                  : 'text-slate-900 dark:text-slate-100'
                }`}
            >
              {item.title}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 text-xs"
                title="Удалить"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {/* Шкала: сегменты по одной на подзадачу, закрашиваются по мере выполнения */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-0.5 min-w-0">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={`flex-1 min-w-0 h-2 rounded-sm first:rounded-l last:rounded-r ${i < done ? 'bg-imperial-gold' : 'bg-gray-200 dark:bg-white/10'
                  }`}
                title={i < done ? 'Выполнено' : 'Не выполнено'}
              />
            ))}
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">
            {done}/{total}
          </span>
        </div>
      )}
      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTitle.trim()) {
                createMutation.mutate(newTitle.trim());
              }
            }}
            placeholder="Добавить подзадачу..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100 text-sm"
          />
          <button
            type="button"
            onClick={() => newTitle.trim() && createMutation.mutate(newTitle.trim())}
            disabled={!newTitle.trim() || createMutation.isPending}
            className="px-3 py-2 bg-imperial-gold text-imperial-bg rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
      )}
    </div>
  );
}
