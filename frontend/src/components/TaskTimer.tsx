import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timetrackingApi, TimeLog } from '../api/timetracking';
import toast from 'react-hot-toast';

interface TaskTimerProps {
  workitemId: number;
  className?: string;
}

/**
 * Форматирование времени в HH:MM:SS
 */
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Форматирование минут в часы и минуты
 */
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`;
}

/**
 * Компонент таймера для задачи
 */
export default function TaskTimer({ workitemId, className = '' }: TaskTimerProps) {
  const queryClient = useQueryClient();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Получаем активный таймер для этой задачи
  const { data: timerData, isLoading } = useQuery({
    queryKey: ['active-timer', workitemId],
    queryFn: () => timetrackingApi.getActiveTimerForTask(workitemId),
    refetchInterval: false,
  });

  // Получаем суммарное время по задаче
  const { data: summaryData } = useQuery({
    queryKey: ['time-summary', workitemId],
    queryFn: () => timetrackingApi.getSummary(workitemId),
  });

  const activeTimer = timerData?.active;
  const isRunning = timerData?.is_running ?? false;

  // Обновляем elapsed_seconds при получении данных
  useEffect(() => {
    if (activeTimer?.elapsed_seconds) {
      setElapsedSeconds(activeTimer.elapsed_seconds);
    } else {
      setElapsedSeconds(0);
    }
  }, [activeTimer]);

  // Тикаем каждую секунду, если таймер запущен
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Мутация для запуска таймера
  const startMutation = useMutation({
    mutationFn: () => timetrackingApi.startTimer(workitemId),
    onSuccess: (data: TimeLog) => {
      queryClient.invalidateQueries({ queryKey: ['active-timer', workitemId] });
      queryClient.invalidateQueries({ queryKey: ['time-summary', workitemId] });
      setElapsedSeconds(data.elapsed_seconds || 0);
      toast.success('Таймер запущен');
    },
    onError: () => toast.error('Ошибка при запуске таймера'),
  });

  // Мутация для остановки таймера
  const stopMutation = useMutation({
    mutationFn: () => timetrackingApi.stopTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer', workitemId] });
      queryClient.invalidateQueries({ queryKey: ['time-summary', workitemId] });
      setElapsedSeconds(0);
      toast.success('Таймер остановлен');
    },
    onError: () => toast.error('Ошибка при остановке таймера'),
  });

  const handleToggle = useCallback(() => {
    if (isRunning) {
      stopMutation.mutate();
    } else {
      startMutation.mutate();
    }
  }, [isRunning, startMutation, stopMutation]);

  const isPending = startMutation.isPending || stopMutation.isPending;

  if (isLoading) {
    return (
      <div className={`animate-pulse flex items-center gap-3 ${className}`}>
        <div className="w-20 h-10 bg-gray-200 dark:bg-slate-600 rounded-lg" />
        <div className="w-16 h-6 bg-gray-200 dark:bg-slate-600 rounded" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Кнопка Start/Stop */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isRunning
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
          }
        `}
      >
        {isRunning ? (
          <>
            <StopIcon className="w-5 h-5" />
            <span>Стоп</span>
          </>
        ) : (
          <>
            <PlayIcon className="w-5 h-5" />
            <span>Старт</span>
          </>
        )}
      </button>

      {/* Бегущий таймер: при продолжении показываем суммарное время (уже учтённые сегменты + текущий) */}
      {isRunning && (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <span className="text-xl font-mono font-bold text-red-600 dark:text-red-400">
            {formatTime((summaryData?.total_minutes ?? 0) * 60 + elapsedSeconds)}
          </span>
        </div>
      )}

      {/* Суммарное время */}
      {summaryData && summaryData.total_minutes > 0 && (
        <div className="text-sm text-gray-500 dark:text-slate-400">
          Всего: {formatMinutes(summaryData.total_minutes)}
        </div>
      )}
    </div>
  );
}

// Иконка Play
function PlayIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Иконка Stop
function StopIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
        clipRule="evenodd"
      />
    </svg>
  );
}
