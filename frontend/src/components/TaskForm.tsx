import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkItem, Project, ProjectMember } from '../types';
import { useNetworkStatus } from './NetworkStatus';
import MemberSelector from './project/MemberSelector';
import { timetrackingApi } from '../api/timetracking';
import toast from 'react-hot-toast';

/** Форматирование секунд в HH:MM:SS или MM:SS */
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'К выполнению' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'review', label: 'На проверке' },
  { value: 'completed', label: 'Завершена' },
  { value: 'cancelled', label: 'Отменена' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
  { value: 'urgent', label: 'Срочный' },
] as const;

const DEFAULT_START_TIME = '09:00';
const DEFAULT_END_TIME = '17:00';

/** Парсинг "HH:MM" (24ч) в часы и минуты */
function parseTime(str: string): { h: number; m: number } {
  if (!str || !str.includes(':')) return { h: 9, m: 0 };
  const [h, m] = str.split(':').map(Number);
  return { h: Math.min(23, Math.max(0, h || 0)), m: Math.min(59, Math.max(0, m || 0)) };
}

function toTimeStr(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** Следующий рабочий день (пн–пт) */
function getNextWorkDay(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

const IMPERIAL_COLORS = [
  { name: 'Золото', hex: '#fbbf24' },
  { name: 'Синий', hex: '#3b82f6' },
  { name: 'Изумруд', hex: '#10b981' },
  { name: 'Пурпур', hex: '#8b5cf6' },
  { name: 'Багровый', hex: '#ef4444' },
  { name: 'Оранжевый', hex: '#f97316' },
  { name: 'Бирюзовый', hex: '#14b8a6' },
  { name: 'Розовый', hex: '#ec4899' },
  { name: 'Лайм', hex: '#84cc16' },
  { name: 'Голубой', hex: '#06b6d4' },
];

export interface TaskFormValues {
  title: string;
  description: string;
  project: number;
  status: string;
  priority: string;
  planned_start_date: string;
  planned_start_time: string;
  planned_end_date: string;
  planned_end_time: string;
  color: string;
}

const defaultValues: TaskFormValues = {
  title: '',
  description: '',
  project: 0,
  status: 'todo',
  priority: 'medium',
  planned_start_date: '',
  planned_start_time: DEFAULT_START_TIME,
  planned_end_date: '',
  planned_end_time: DEFAULT_END_TIME,
  color: '#fbbf24',
};

interface TaskFormProps {
  task?: WorkItem | null;
  /** Список проектов (или { results: Project[] } — нормализуется внутри) */
  projects?: Project[] | { results?: Project[] };
  defaultProjectId?: number;
  /** При создании из Канбана — колонка, в которую попадёт задача */
  defaultColumnId?: number;
  /** При создании из Канбана — статус по колонке (plan→todo, in_progress→in_progress, done→completed) */
  defaultStatus?: WorkItem['status'];
  onSubmit: (data: Partial<WorkItem>) => void;
  onCancel?: () => void;
  /** Старт задачи (перевод в «В работе») — показывается только при редактировании */
  onStart?: () => void;
  /** Завершить задачу — показывается только при редактировании */
  onComplete?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  /** Доп. ключи для инвалидации при изменении чек-листа (например, канбан-доска) */
  invalidateKeys?: unknown[][];
}

export default function TaskForm({
  task,
  projects,
  defaultProjectId,
  defaultColumnId,
  defaultStatus,
  onSubmit,
  onCancel,
  onStart,
  onComplete,
  isSubmitting = false,
  submitLabel = 'Сохранить',
  invalidateKeys: propInvalidateKeys,
}: TaskFormProps) {
  const isOffline = useNetworkStatus();
  const projectList: Project[] = Array.isArray(projects)
    ? projects
    : (projects && 'results' in projects && Array.isArray(projects.results) ? projects.results : []);
  const [values, setValues] = useState<TaskFormValues>(defaultValues);
  const [responsible, setResponsible] = useState<ProjectMember | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormValues, string>>>({});

  useEffect(() => {
    const nextWorkDay = getNextWorkDay();
    if (task) {
      setValues({
        title: task.title,
        description: task.description || '',
        project: task.project,
        status: task.status,
        priority: task.priority,
        planned_start_date: task.start_date ? task.start_date.slice(0, 10) : '',
        planned_start_time: DEFAULT_START_TIME,
        planned_end_date: task.due_date ? task.due_date.slice(0, 10) : '',
        planned_end_time: DEFAULT_END_TIME,
        color: task.color || '#fbbf24',
      });
      setResponsible(task.responsible ?? null);
    } else {
      setValues({
        ...defaultValues,
        project: defaultProjectId ?? projectList[0]?.id ?? 0,
        status: defaultStatus ?? defaultValues.status,
        planned_start_date: nextWorkDay,
        planned_start_time: DEFAULT_START_TIME,
        planned_end_date: nextWorkDay,
        planned_end_time: DEFAULT_END_TIME,
      });
      setResponsible(null);
    }
  }, [task, defaultProjectId, defaultStatus, projectList]);

  const workitemId = task?.id;
  const { data: timerData } = useQuery({
    queryKey: ['active-timer', workitemId],
    queryFn: () => timetrackingApi.getActiveTimerForTask(workitemId!),
    enabled: !!workitemId,
  });
  const { data: summaryData } = useQuery({
    queryKey: ['time-summary', workitemId],
    queryFn: () => timetrackingApi.getSummary(workitemId!),
    enabled: !!workitemId,
  });
  const queryClient = useQueryClient();
  const activeTimer = timerData?.active;
  const isTimerRunning = timerData?.is_running ?? false;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (activeTimer?.elapsed_seconds != null) setElapsedSeconds(activeTimer.elapsed_seconds);
    else setElapsedSeconds(0);
  }, [activeTimer]);
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const startTimerMutation = useMutation({
    mutationFn: (id: number) => timetrackingApi.startTimer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer', workitemId] });
      queryClient.invalidateQueries({ queryKey: ['time-summary', workitemId] });
      toast.success('Таймер запущен');
    },
    onError: () => toast.error('Ошибка запуска таймера'),
  });
  const stopTimerMutation = useMutation({
    mutationFn: () => timetrackingApi.stopTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer', workitemId] });
      queryClient.invalidateQueries({ queryKey: ['time-summary', workitemId] });
      if (workitemId) queryClient.invalidateQueries({ queryKey: ['task', workitemId] });
      setElapsedSeconds(0);
      toast.success('Таймер остановлен');
    },
    onError: () => toast.error('Ошибка остановки таймера'),
  });

  const handleStart = useCallback(() => {
    if (workitemId) startTimerMutation.mutate(workitemId);
    onStart?.();
  }, [workitemId, onStart, startTimerMutation]);
  const handleComplete = useCallback(async () => {
    if (isTimerRunning) await stopTimerMutation.mutateAsync();
    onComplete?.();
  }, [isTimerRunning, onComplete, stopTimerMutation]);
  const timerPending = startTimerMutation.isPending || stopTimerMutation.isPending;

  const validate = (): boolean => {
    const next: Partial<Record<keyof TaskFormValues, string>> = {};
    if (!values.title.trim()) next.title = 'Обязательное поле';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const startDate = values.planned_start_date || getNextWorkDay();
    const endDate = values.planned_end_date || startDate;
    const payload: Partial<WorkItem> = {
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      project: values.project || undefined,
      status: values.status as WorkItem['status'],
      priority: values.priority as WorkItem['priority'],
      start_date: startDate,
      due_date: endDate,
      responsible_id: responsible?.id ?? null,
      color: values.color || undefined,
    };
    if (defaultColumnId != null && !task) {
      payload.kanban_column = defaultColumnId;
    }
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
        <input
          type="text"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Название задачи"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
      </div>

      <div className="mt-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
        <textarea
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          rows={1}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2.25rem] h-11 resize-y"
          placeholder="Описание задачи"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Проект</label>
        <select
          value={values.project}
          onChange={(e) => setValues((v) => ({ ...v, project: Number(e.target.value) }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          disabled={!!task}
        >
          <option value={0}>Без проекта</option>
          {projectList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errors.project && <p className="mt-1 text-sm text-red-600">{errors.project}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
          <select
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Приоритет</label>
          <select
            value={values.priority}
            onChange={(e) => setValues((v) => ({ ...v, priority: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 scale-[0.95] origin-top-left">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-imperial-muted mb-1">Планируем начать</label>
          <div className="flex gap-0.5 items-center min-w-0">
            <select
              value={parseTime(values.planned_start_time).h}
              onChange={(e) => {
                const { m } = parseTime(values.planned_start_time);
                setValues((v) => ({ ...v, planned_start_time: toTimeStr(Number(e.target.value), m) }));
              }}
              className="w-11 min-w-0 px-1 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-imperial-text"
              title="Часы (24)"
            >
              {HOURS_24.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 dark:text-imperial-muted shrink-0">:</span>
            <select
              value={parseTime(values.planned_start_time).m}
              onChange={(e) => {
                const { h } = parseTime(values.planned_start_time);
                setValues((v) => ({ ...v, planned_start_time: toTimeStr(h, Number(e.target.value)) }));
              }}
              className="w-11 min-w-0 px-1 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-imperial-text"
              title="Минуты"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
            <input
              type="date"
              value={values.planned_start_date}
              onChange={(e) => setValues((v) => ({ ...v, planned_start_date: e.target.value }))}
              className="w-[100px] min-w-[100px] shrink-0 px-1.5 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-imperial-text [color-scheme:light] dark:[color-scheme:dark]"
              title="Дата начала"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-imperial-muted mb-1">Планируется закончить</label>
          <div className="flex gap-0.5 items-center min-w-0">
            <select
              value={parseTime(values.planned_end_time).h}
              onChange={(e) => {
                const { m } = parseTime(values.planned_end_time);
                setValues((v) => ({ ...v, planned_end_time: toTimeStr(Number(e.target.value), m) }));
              }}
              className="w-11 min-w-0 px-1 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-imperial-text"
              title="Часы (24)"
            >
              {HOURS_24.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 dark:text-imperial-muted shrink-0">:</span>
            <select
              value={parseTime(values.planned_end_time).m}
              onChange={(e) => {
                const { h } = parseTime(values.planned_end_time);
                setValues((v) => ({ ...v, planned_end_time: toTimeStr(h, Number(e.target.value)) }));
              }}
              className="w-11 min-w-0 px-1 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-imperial-text"
              title="Минуты"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
            <input
              type="date"
              value={values.planned_end_date}
              onChange={(e) => setValues((v) => ({ ...v, planned_end_date: e.target.value }))}
              className="w-[100px] min-w-[100px] shrink-0 px-1.5 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-imperial-text [color-scheme:light] dark:[color-scheme:dark]"
              title="Дата окончания"
            />
          </div>
        </div>
      </div>

      {values.project > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-imperial-muted mb-1">Ответственный</label>
          <MemberSelector
            projectId={values.project}
            value={responsible}
            onChange={setResponsible}
            placeholder="Выберите ответственного"
            membersFromProject={projectList.find((p) => p.id === values.project)?.members}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-imperial-muted mb-1">Цвет (Imperial Illumination)</label>
        <div className="flex flex-wrap gap-2">
          {IMPERIAL_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setValues((v) => ({ ...v, color: c.hex }))}
              className="w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:border-white/20"
              style={{
                backgroundColor: c.hex,
                borderColor: values.color === c.hex ? 'var(--tw-ring-color, #3b82f6)' : 'transparent',
                boxShadow: values.color === c.hex ? `0 0 12px ${c.hex}80` : undefined,
              }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end items-center gap-2 pt-4 flex-wrap">
        {/* Таймер: слева от кнопок. При "Продолжить" показываем суммарное время (уже учтённые сегменты + текущий). */}
        {workitemId && (
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-lg font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
              {(() => {
                const totalDisplaySeconds = (summaryData?.total_minutes ?? 0) * 60 + elapsedSeconds;
                return isTimerRunning ? (
                  <span className="text-amber-600 dark:text-amber-400">{formatTime(totalDisplaySeconds)}</span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">{formatTime(totalDisplaySeconds)}</span>
                );
              })()}
            </span>
            {summaryData && summaryData.total_minutes > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Всего: {formatMinutes(summaryData.total_minutes)}
              </span>
            )}
          </div>
        )}
        {task && (task.status === 'completed' || task.status === 'cancelled') && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="font-medium">{task.status === 'completed' ? 'Завершена' : 'Отменена'}</span>
            {(summaryData?.total_minutes ?? 0) > 0 || (task.actual_hours != null && Number(task.actual_hours) > 0) ? (
              <span className="text-slate-500 dark:text-slate-400">
                Время выполнения:{' '}
                {summaryData && summaryData.total_minutes > 0
                  ? formatMinutes(summaryData.total_minutes)
                  : formatMinutes(Math.round(Number(task.actual_hours) * 60))}
              </span>
            ) : null}
          </div>
        )}
        {task && onStart && task.status !== 'in_progress' && task.status !== 'review' && task.status !== 'completed' && task.status !== 'cancelled' && (
          <button
            type="button"
            onClick={handleStart}
            disabled={isSubmitting || isOffline || timerPending}
            className="px-2 py-1 text-sm bg-amber-500 text-slate-900 rounded-md hover:bg-amber-400 disabled:opacity-50"
          >
            Старт
          </button>
        )}
        {task && workitemId && (task.status === 'in_progress' || task.status === 'review' || isTimerRunning) && (
          <button
            type="button"
            onClick={() => isTimerRunning ? stopTimerMutation.mutate() : startTimerMutation.mutate(workitemId!)}
            disabled={timerPending || isSubmitting || isOffline}
            className="px-2 py-1 text-sm bg-slate-500 text-white rounded-md hover:bg-slate-600 disabled:opacity-50"
            title={isTimerRunning ? 'Приостановить таймер' : 'Продолжить отсчёт'}
          >
            {isTimerRunning ? 'Пауза' : 'Продолжить'}
          </button>
        )}
        {task && onComplete && task.status !== 'completed' && task.status !== 'cancelled' && (
          <button
            type="button"
            onClick={handleComplete}
            disabled={isSubmitting || isOffline || timerPending}
            className="px-2 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Готово
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-sm text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600"
          >
            Отмена
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || isOffline}
          className="px-2 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Сохранение…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
