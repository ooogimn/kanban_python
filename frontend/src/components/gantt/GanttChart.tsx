import { useState, useCallback, useRef, useEffect } from 'react';
import {
  format,
  parseISO,
  differenceInDays,
  startOfDay,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  addDays,
  addMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';

type TimeScaleInterval = 'day' | 'week' | 'month';
import type { GanttTask, GanttDependency } from '../../types';

const ROW_HEIGHT_BASE = 40;
const HEADER_HEIGHT_BASE = 48;
const LABEL_WIDTH_BASE = 220;
const DAY_WIDTH_BASE = 24;
const SCALE_MIN = 0.5;
const SCALE_MAX = 2;
const SCALE_DEFAULT = 1;

/** Формат даты везде: день, месяц, год (русская локаль). */
const FMT_DAY_MONTH_YEAR = 'd MMMM yyyy';
const FMT_DAY_MONTH_YEAR_SHORT = 'd MMM yyyy';
const FMT_MONTH_YEAR = 'LLLL yyyy';
const RU_LOCALE = { locale: ru };

/** Парсит дату без сдвига по таймзоне (YYYY-MM-DD → локальная полуночь). */
function parseDateOnly(s: string | null | undefined): Date {
  if (!s) return new Date();
  const match = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return startOfDay(parseISO(s));
}

/** Собирает все задачи в плоский список (корневые + вложенные). */
function flattenTasks(tasks: GanttTask[]): GanttTask[] {
  const out: GanttTask[] = [];
  function walk(list: GanttTask[]) {
    for (const t of list) {
      out.push(t);
      if (t.children?.length) walk(t.children);
    }
  }
  walk(tasks);
  return out;
}

interface GanttChartProps {
  tasks: GanttTask[];
  dependencies: GanttDependency[];
  projectName: string;
  projectId: number;
  onTaskUpdate?: (taskId: number, data: { start_date: string; end_date: string }) => void;
  onTaskClick?: (task: GanttTask) => void;
  onDependencyCreate?: (predecessorId: number, successorId: number) => void;
  onDependencyDelete?: (dependencyId: number) => void;
  isUpdating?: boolean;
}

export default function GanttChart({
  tasks,
  dependencies,
  projectName,
  projectId: _projectId,
  onTaskUpdate,
  onTaskClick,
  onDependencyCreate,
  onDependencyDelete,
  isUpdating = false,
}: GanttChartProps) {
  const flatTasks = flattenTasks(tasks);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Масштаб времени: меняет только ширину колонок шкалы (пикселей на день) и отрезков задач
  const [scaleFactor, setScaleFactor] = useState(SCALE_DEFAULT);
  const dayWidthPx = DAY_WIDTH_BASE * scaleFactor;
  const rowHeight = ROW_HEIGHT_BASE; // base — zoom масштабирует визуально
  const headerHeight = HEADER_HEIGHT_BASE;
  const labelWidth = LABEL_WIDTH_BASE;

  const zoomIn = useCallback(() => {
    setScaleFactor((prev) => Math.min(SCALE_MAX, prev + 0.25));
  }, []);
  const zoomOut = useCallback(() => {
    setScaleFactor((prev) => Math.max(SCALE_MIN, prev - 0.25));
  }, []);
  const handleWheelZoom = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
      }
    },
    [zoomIn, zoomOut]
  );

  // Интервал шкалы времени: день / неделя / месяц
  const [timeScaleInterval, setTimeScaleInterval] = useState<TimeScaleInterval>('day');

  // Полноэкранный режим
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Оптимистичное положение полоски во время перетаскивания (сдвиг)
  const [dragState, setDragState] = useState<{
    taskId: number;
    startX: number;
    originalStart: Date;
    originalEnd: Date;
    currentStart: Date;
    currentEnd: Date;
  } | null>(null);

  // Resize: растягивание полоски (изменение end_date)
  const [resizeState, setResizeState] = useState<{
    taskId: number;
    startX: number;
    originalEnd: Date;
    currentEnd: Date;
    taskStart: Date;
  } | null>(null);

  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, task: GanttTask) => {
      e.preventDefault();
      if (!onTaskUpdate) return;
      const start = parseDateOnly(task.start_date);
      const end = parseDateOnly(task.end_date);
      setDragState({
        taskId: task.id,
        startX: e.clientX,
        originalStart: start,
        originalEnd: end,
        currentStart: start,
        currentEnd: end,
      });
    },
    [onTaskUpdate]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState) return;
      const deltaPx = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaPx / dayWidthPx);
      let newStart = addDays(dragState.originalStart, deltaDays);
      let newEnd = addDays(dragState.originalEnd, deltaDays);
      const durationDays = differenceInDays(dragState.originalEnd, dragState.originalStart);
      if (differenceInDays(newEnd, newStart) < durationDays) {
        if (deltaDays >= 0) newEnd = addDays(newStart, durationDays);
        else newStart = addDays(newEnd, -durationDays);
      }
      setDragState((s) => (s ? { ...s, currentStart: newStart, currentEnd: newEnd } : null));
    },
    [dragState, dayWidthPx]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState || !onTaskUpdate) {
      setDragState(null);
      return;
    }
    const { taskId, currentStart, currentEnd } = dragState;
    onTaskUpdate(taskId, {
      start_date: format(currentStart, 'yyyy-MM-dd'),
      end_date: format(currentEnd, 'yyyy-MM-dd'),
    });
    setDragState(null);
  }, [dragState, onTaskUpdate]);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, task: GanttTask) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onTaskUpdate) return;
      const taskStart = parseDateOnly(task.start_date);
      const end = parseDateOnly(task.end_date);
      setResizeState({
        taskId: task.id,
        startX: e.clientX,
        originalEnd: end,
        currentEnd: end,
        taskStart,
      });
    },
    [onTaskUpdate]
  );

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!resizeState) return;
    const deltaPx = e.clientX - resizeState.startX;
    const deltaDays = Math.round(deltaPx / dayWidthPx);
    let newEnd = addDays(resizeState.originalEnd, deltaDays);
    if (newEnd < resizeState.taskStart) newEnd = resizeState.taskStart;
    setResizeState((s) => (s ? { ...s, currentEnd: newEnd } : null));
  }, [resizeState, dayWidthPx]);

  const handleResizeMouseUp = useCallback(() => {
    if (!resizeState || !onTaskUpdate) {
      setResizeState(null);
      return;
    }
    const { taskId, currentEnd, taskStart } = resizeState;
    onTaskUpdate(taskId, {
      start_date: format(taskStart, 'yyyy-MM-dd'),
      end_date: format(currentEnd, 'yyyy-MM-dd'),
    });
    setResizeState(null);
  }, [resizeState, onTaskUpdate]);

  // Подписка на глобальные mousemove/mouseup при перетаскивании
  useEffect(() => {
    if (!dragState) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (!resizeState) return;
    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [resizeState, handleResizeMouseMove, handleResizeMouseUp]);

  const [depPredecessor, setDepPredecessor] = useState<number>(0);
  const [depSuccessor, setDepSuccessor] = useState<number>(0);

  const handleCreateDependency = useCallback(() => {
    if (depPredecessor && depSuccessor && depPredecessor !== depSuccessor && onDependencyCreate) {
      onDependencyCreate(depPredecessor, depSuccessor);
      setDepPredecessor(0);
      setDepSuccessor(0);
    }
  }, [depPredecessor, depSuccessor, onDependencyCreate]);

  if (flatTasks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
        Нет задач с датами для отображения на диаграмме Ганта. Задачи проекта синхронизируются с Гантом автоматически.
      </div>
    );
  }

  const datePairs = flatTasks.map((t) => {
    const drag = dragState?.taskId === t.id ? dragState : null;
    const resize = resizeState?.taskId === t.id ? resizeState : null;
    const start = resize
      ? resize.taskStart
      : drag
        ? drag.currentStart
        : parseDateOnly(t.start_date);
    const end = resize
      ? resize.currentEnd
      : drag
        ? drag.currentEnd
        : parseDateOnly(t.end_date);
    return [start, end] as [Date, Date];
  });
  const starts = datePairs.map((d) => d[0]);
  const ends = datePairs.map((d) => d[1]);
  const taskMinD = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : new Date();
  const taskMaxD = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : new Date();

  // Задаваемый период шкалы (null = авто по задачам)
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null);

  const minD = dateRangeStart ? parseDateOnly(dateRangeStart) : taskMinD;
  const maxD = dateRangeEnd ? parseDateOnly(dateRangeEnd) : taskMaxD;
  const totalDays = Math.max(1, differenceInDays(maxD, minD) + 1);

  const resetDateRange = useCallback(() => {
    setDateRangeStart(null);
    setDateRangeEnd(null);
  }, []);
  const dayList = eachDayOfInterval({ start: minD, end: maxD });

  // Точки шкалы для вертикальных линий (границы недель/месяцев)
  const weekStarts = eachWeekOfInterval({ start: minD, end: maxD }, { weekStartsOn: 1 });
  const monthStarts = eachMonthOfInterval({ start: minD, end: maxD });

  const getLeft = (date: Date) => (differenceInDays(date, minD) / totalDays) * 100;
  /** Длительность: обе даты включительно. 2 фев — 10 фев = ячейки 2,3,4,5,6,7,8,9,10 = 9 дней */
  const getWidth = (start: Date, end: Date) => {
    const days = Math.max(1, differenceInDays(end, start) + 1);
    return (days / totalDays) * 100;
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800 shadow-sm ${isFullscreen ? 'h-full overflow-y-auto p-4' : ''}`}
      style={isFullscreen ? { minHeight: '100vh' } : undefined}
    >
      <div className="mb-2 px-4 py-2 border-b border-slate-100 dark:border-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{projectName}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Период: {format(minD, FMT_DAY_MONTH_YEAR, RU_LOCALE)} — {format(maxD, FMT_DAY_MONTH_YEAR, RU_LOCALE)}
              {onTaskUpdate && (
                <span className="ml-2 text-slate-400 dark:text-slate-500">
                  • Перетащите полоску — сдвиг; правый край — длительность. Ctrl+колёсико — масштаб времени
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span title="Начало периода (день, месяц, год)">С:</span>
              <input
                type="date"
                value={dateRangeStart ?? format(taskMinD, 'yyyy-MM-dd')}
                onChange={(e) => setDateRangeStart(e.target.value || null)}
                className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                title={`Начало периода: ${format(dateRangeStart ? parseISO(dateRangeStart) : taskMinD, FMT_DAY_MONTH_YEAR, RU_LOCALE)} (день, месяц, год)`}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span title="Конец периода (день, месяц, год)">По:</span>
              <input
                type="date"
                value={dateRangeEnd ?? format(taskMaxD, 'yyyy-MM-dd')}
                onChange={(e) => setDateRangeEnd(e.target.value || null)}
                className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                title={`Конец периода: ${format(dateRangeEnd ? parseISO(dateRangeEnd) : taskMaxD, FMT_DAY_MONTH_YEAR, RU_LOCALE)} (день, месяц, год)`}
              />
            </label>
            <button
              type="button"
              onClick={resetDateRange}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
              title="Авто по задачам"
            >
              Авто
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Шкала:</span>
            <select
              value={timeScaleInterval}
              onChange={(e) => setTimeScaleInterval(e.target.value as TimeScaleInterval)}
              className="px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-xs"
            >
              <option value="day">День</option>
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
            </select>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
            title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Масштаб времени:</span>
          <button
            type="button"
            onClick={zoomOut}
            disabled={scaleFactor <= SCALE_MIN}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-bold"
            title="Уменьшить"
          >
            −
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={scaleFactor >= SCALE_MAX}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-bold"
            title="Увеличить"
          >
            +
          </button>
        </div>
      </div>

      <div
        className="flex shrink-0"
        style={{ width: labelWidth + dayList.length * dayWidthPx }}
        ref={chartAreaRef}
        onWheel={handleWheelZoom}
        role="application"
        tabIndex={0}
      >
        {/* Левая колонка — названия */}
        <div
          className="shrink-0 border-r border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/80"
          style={{ width: labelWidth }}
        >
          <div
            className="flex items-center border-b border-slate-200 dark:border-slate-600 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            style={{ height: headerHeight }}
          >
            Задача
          </div>
          {flatTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center border-b border-slate-100 dark:border-slate-700 px-3 text-sm text-slate-800 dark:text-slate-200 truncate"
              style={{ height: rowHeight }}
              title={task.name}
            >
              {task.name}
            </div>
          ))}
        </div>

        {/* Область диаграммы */}
        <div className="relative flex-1 min-w-0 dark:bg-slate-800/50">
          {/* Двухуровневая шкала времени: месяцы + дни/недели/месяцы */}
          <div
            className="flex flex-col border-b-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 shrink-0"
            style={{
              width: dayList.length * dayWidthPx,
            }}
          >
            {/* Строка 1: Месяцы */}
            <div
              className="flex border-b border-slate-300 dark:border-slate-600"
              style={{ height: headerHeight / 2, minHeight: 20 }}
            >
              {monthStarts.map((monthStart, idx) => {
                const nextMonth = idx < monthStarts.length - 1 ? monthStarts[idx + 1] : addMonths(monthStart, 1);
                const monthDays = Math.min(differenceInDays(nextMonth, monthStart), differenceInDays(maxD, monthStart) + 1);
                const span = Math.max(1, monthDays);
                const spanPx = span * dayWidthPx;
                return (
                  <div
                    key={monthStart.toISOString()}
                    className="shrink-0 flex items-center justify-center border-r border-slate-300 dark:border-slate-600 px-1 font-semibold text-slate-700 dark:text-slate-300"
                    style={{ width: spanPx, fontSize: 11 }}
                    title={format(monthStart, FMT_MONTH_YEAR, RU_LOCALE)}
                  >
                    {format(monthStart, FMT_DAY_MONTH_YEAR_SHORT, RU_LOCALE)}
                  </div>
                );
              })}
            </div>
            {/* Строка 2: Дни / Недели / Месяцы по интервалу */}
            <div
              className="flex border-b border-slate-200 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-800/90"
              style={{ height: headerHeight / 2, minHeight: 20 }}
            >
              {timeScaleInterval === 'day' &&
                dayList.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="shrink-0 flex flex-col items-center justify-center border-r border-slate-200 dark:border-slate-600 px-0.5 py-0.5 text-slate-600 dark:text-slate-400"
                    style={{ width: dayWidthPx, fontSize: 10 }}
                    title={format(day, `EEEE, ${FMT_DAY_MONTH_YEAR}`, RU_LOCALE)}
                  >
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">{format(day, 'EEEEEE', RU_LOCALE)}</span>
                    <span className="font-medium">{format(day, 'd')}</span>
                  </div>
                ))}
              {timeScaleInterval === 'week' &&
                weekStarts.map((weekStart) => {
                  const daysInWeek = Math.min(7, differenceInDays(maxD, weekStart) + 1);
                  const span = Math.max(1, daysInWeek);
                  const spanPx = span * dayWidthPx;
                  return (
                    <div
                      key={weekStart.toISOString()}
                      className="shrink-0 flex flex-col items-center justify-center border-r border-slate-300 dark:border-slate-600 px-1 py-0.5 text-slate-600 dark:text-slate-400"
                      style={{ width: spanPx, fontSize: 10 }}
                      title={`Неделя: ${format(weekStart, FMT_DAY_MONTH_YEAR, RU_LOCALE)} — ${format(addDays(weekStart, span - 1), FMT_DAY_MONTH_YEAR, RU_LOCALE)}`}
                    >
                      <span className="text-[9px] text-slate-400 dark:text-slate-500">пн</span>
                      <span className="font-medium">{format(weekStart, FMT_DAY_MONTH_YEAR_SHORT, RU_LOCALE)}</span>
                    </div>
                  );
                })}
              {timeScaleInterval === 'month' &&
                monthStarts.map((monthStart, idx) => {
                  const nextMonth = idx < monthStarts.length - 1 ? monthStarts[idx + 1] : addMonths(monthStart, 1);
                  const monthDays = Math.min(differenceInDays(nextMonth, monthStart), differenceInDays(maxD, monthStart) + 1);
                  const span = Math.max(1, monthDays);
                  const spanPx = span * dayWidthPx;
                  return (
                    <div
                      key={monthStart.toISOString()}
                      className="shrink-0 flex flex-col items-center justify-center border-r border-slate-300 dark:border-slate-600 px-1 py-0.5 text-slate-600 dark:text-slate-400"
                      style={{ width: spanPx, fontSize: 10 }}
                      title={format(monthStart, FMT_MONTH_YEAR, RU_LOCALE)}
                    >
                      <span className="text-[9px] text-slate-400 dark:text-slate-500">{format(monthStart, 'yyyy', RU_LOCALE)}</span>
                      <span className="font-medium">{format(monthStart, FMT_DAY_MONTH_YEAR_SHORT, RU_LOCALE)}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Полоски задач + SVG линии зависимостей + вертикальная сетка */}
          <div
            className="relative bg-transparent shrink-0"
            style={{
              width: dayList.length * dayWidthPx,
              height: flatTasks.length * rowHeight,
            }}
          >
            {/* Вертикальные линии сетки: светлая тема */}
            {(() => {
              const chartW = dayList.length * dayWidthPx;
              const chartH = flatTasks.length * rowHeight;
              return (
                <svg className="absolute inset-0 pointer-events-none dark:opacity-0" width={chartW} height={chartH} style={{ left: 0, top: 0 }}>
                  {weekStarts.map((d, idx) => {
                    if (idx === 0) return null;
                    const x = (differenceInDays(d, minD) / totalDays) * chartW;
                    const isMonthBoundary = monthStarts.some((m) => differenceInDays(m, d) === 0);
                    return (
                      <line
                        key={`w-${d.toISOString()}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={chartH}
                        stroke={isMonthBoundary ? '#64748b' : '#cbd5e1'}
                        strokeWidth={isMonthBoundary ? 1.5 : 0.5}
                      />
                    );
                  })}
                  {monthStarts.map((d, idx) => {
                    if (idx === 0) return null;
                    const x = (differenceInDays(d, minD) / totalDays) * chartW;
                    return (
                      <line
                        key={`m-${d.toISOString()}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={chartH}
                        stroke="#475569"
                        strokeWidth={2}
                      />
                    );
                  })}
                </svg>
              );
            })()}
            {/* Вертикальные линии сетки: тёмная тема (светлые линии на тёмном фоне) */}
            {(() => {
              const chartW = dayList.length * dayWidthPx;
              const chartH = flatTasks.length * rowHeight;
              return (
                <svg className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-100" width={chartW} height={chartH} style={{ left: 0, top: 0 }}>
                  {weekStarts.map((d, idx) => {
                    if (idx === 0) return null;
                    const x = (differenceInDays(d, minD) / totalDays) * chartW;
                    const isMonthBoundary = monthStarts.some((m) => differenceInDays(m, d) === 0);
                    return (
                      <line
                        key={`w-${d.toISOString()}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={chartH}
                        stroke={isMonthBoundary ? '#94a3b8' : '#475569'}
                        strokeWidth={isMonthBoundary ? 1.5 : 0.5}
                      />
                    );
                  })}
                  {monthStarts.map((d, idx) => {
                    if (idx === 0) return null;
                    const x = (differenceInDays(d, minD) / totalDays) * chartW;
                    return (
                      <line
                        key={`m-${d.toISOString()}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={chartH}
                        stroke="#cbd5e1"
                        strokeWidth={2}
                      />
                    );
                  })}
                </svg>
              );
            })()}
            {/* Линии зависимостей (predecessor end → successor start). SPRINT 1: контраст в тёмной теме (imperial-gold). */}
            {dependencies.length > 0 && (() => {
              const chartW = dayList.length * dayWidthPx;
              const chartH = flatTasks.length * rowHeight;
              const barEdgeInsetPx = 6;
              const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
              for (const d of dependencies) {
                // В API: predecessor = кто идёт раньше (от него линия), successor = кто идёт позже (к нему стрелка).
                // Рисуем от правого края «предшественника» к левому краю «преемника».
                const idxFrom = flatTasks.findIndex((t) => t.id === d.predecessor);
                const idxTo = flatTasks.findIndex((t) => t.id === d.successor);
                if (idxFrom < 0 || idxTo < 0 || idxFrom === idxTo) continue;
                const [startFrom, endFrom] = datePairs[idxFrom];
                const [startTo] = datePairs[idxTo];
                const leftFromPct = (differenceInDays(startFrom, minD) / totalDays) * 100;
                const widthFromPct = (differenceInDays(endFrom, startFrom) + 1) / totalDays * 100;
                const leftToPct = (differenceInDays(startTo, minD) / totalDays) * 100;
                const rightFromPx = (leftFromPct + widthFromPct) / 100 * chartW;
                const leftToPx = (leftToPct / 100) * chartW;
                const x1 = Math.max(barEdgeInsetPx, rightFromPx - barEdgeInsetPx);
                const x2 = Math.min(chartW - barEdgeInsetPx, leftToPx + barEdgeInsetPx);
                if (x2 <= x1) continue;
                const y1 = idxFrom * rowHeight + rowHeight / 2;
                const y2 = idxTo * rowHeight + rowHeight / 2;
                lines.push({ x1, y1, x2, y2 });
              }
              return (
                <div className="absolute inset-0 pointer-events-none text-slate-400 dark:text-amber-400/90 z-10" style={{ left: 0, top: 0 }}>
                  <svg width={chartW} height={chartH} className="block">
                    {lines.map((line, idx) => (
                      <line
                        key={idx}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        markerEnd="url(#gantt-arrow)"
                      />
                    ))}
                    <defs>
                      <marker id="gantt-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                        <polygon points="0 0, 10 5, 0 10" fill="currentColor" />
                      </marker>
                    </defs>
                  </svg>
                </div>
              );
            })()}
            {flatTasks.map((task, i) => {
              const start = datePairs[i][0];
              const end = datePairs[i][1];
              const left = getLeft(start);
              const width = getWidth(start, end);
              const isDragging = dragState?.taskId === task.id;
              return (
                <div
                  key={task.id}
                  className="absolute flex items-center px-1"
                  style={{
                    top: i * rowHeight,
                    left: `${left}%`,
                    width: `${width}%`,
                    height: rowHeight - 4,
                    minHeight: 20,
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onMouseDown={(e) => handleBarMouseDown(e, task)}
                    className={`h-full w-full rounded-md text-white flex items-center justify-between px-2 text-xs shadow-sm ${onTaskUpdate ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${isDragging ? 'ring-2 ring-offset-1' : ''}`}
                    style={{
                      backgroundColor: task.color || '#fbbf24',
                      ...(isDragging ? { boxShadow: `0 0 0 2px ${task.color || '#fbbf24'}80` } : {}),
                    }}
                    title={onTaskUpdate ? `${task.name} • Перетащите для сдвига` : `${task.name} • ${task.progress}%`}
                  >
                    <span
                      className={`truncate ${onTaskClick && task.related_workitem ? 'cursor-pointer hover:underline' : ''}`}
                      role={onTaskClick && task.related_workitem ? 'button' : undefined}
                      tabIndex={onTaskClick && task.related_workitem ? 0 : undefined}
                      onMouseDown={onTaskClick && task.related_workitem ? (e) => e.stopPropagation() : undefined}
                      onClick={
                        onTaskClick && task.related_workitem
                          ? (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onTaskClick(task);
                          }
                          : undefined
                      }
                      onKeyDown={
                        onTaskClick && task.related_workitem
                          ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onTaskClick(task);
                            }
                          }
                          : undefined
                      }
                      title={onTaskClick && task.related_workitem ? 'Открыть задачу' : undefined}
                    >
                      {task.name}
                    </span>
                    {task.progress > 0 && (
                      <span className="shrink-0 ml-1 font-medium">{task.progress}%</span>
                    )}
                  </div>
                  {onTaskUpdate && (
                    <div
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => handleResizeMouseDown(e, task)}
                      className="absolute right-0 top-0 bottom-0 w-2 rounded-r cursor-ew-resize opacity-80 hover:opacity-100 z-10"
                      style={{ backgroundColor: task.color || '#fbbf24' }}
                      title="Растянуть/сжать по длительности"
                    />
                  )}
                  {task.progress > 0 && task.progress < 100 && (
                    <div
                      className="absolute inset-y-1 left-1 rounded-l pointer-events-none opacity-60"
                      style={{ width: `${task.progress}%`, backgroundColor: task.color || '#fbbf24' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Зависимости + форма добавления */}
      <div className="mt-4 px-4 pb-4 border-t border-slate-100 dark:border-slate-600 pt-3 space-y-3">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Зависимости ({dependencies.length})
        </p>
        {dependencies.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Пока нет связей между задачами. Стрелки между полосками и список появятся после добавления. Выберите предшественника и преемника ниже и нажмите «Добавить».
          </p>
        ) : (
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
            {dependencies.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span>
                  {d.predecessor_name ?? `#${d.predecessor}`} → {d.successor_name ?? `#${d.successor}`}{' '}
                  <span className="text-slate-400 dark:text-slate-500">({d.type})</span>
                </span>
                {onDependencyDelete && (
                  <button
                    type="button"
                    onClick={() => onDependencyDelete(d.id)}
                    className="text-red-500 hover:text-red-700 text-xs px-1.5 py-0.5 rounded"
                    title="Удалить зависимость"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {onDependencyCreate && flatTasks.length >= 2 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Добавить связь:</span>
            <select
              value={depPredecessor}
              onChange={(e) => setDepPredecessor(Number(e.target.value))}
              className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-sm"
            >
              <option value={0}>— предшественник —</option>
              {flatTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="text-slate-400 dark:text-slate-500">→</span>
            <select
              value={depSuccessor}
              onChange={(e) => setDepSuccessor(Number(e.target.value))}
              className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-sm"
            >
              <option value={0}>— преемник —</option>
              {flatTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreateDependency}
              disabled={!depPredecessor || !depSuccessor || depPredecessor === depSuccessor}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Добавить
            </button>
          </div>
        )}
      </div>

      {isUpdating && (
        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/70 flex items-center justify-center rounded-xl">
          <span className="text-sm text-slate-600 dark:text-slate-300">Сохранение...</span>
        </div>
      )}
    </div>
  );
}
