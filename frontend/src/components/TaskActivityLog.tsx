import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../api/activity';
import type { ActivityLog } from '../types';

function formatDate(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const today = now.toDateString() === d.toDateString();
  if (today) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionIcon(action: string): string {
  switch (action) {
    case 'create': return '➕';
    case 'update': return '✏️';
    case 'delete': return '🗑️';
    default: return '•';
  }
}

interface TaskActivityLogProps {
  workitemId: number;
}

export default function TaskActivityLog({ workitemId }: TaskActivityLogProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['activity', 'task', workitemId],
    queryFn: () => activityApi.getTaskActivity(workitemId),
    enabled: workitemId > 0,
  });

  if (isLoading) return <div className="py-8 text-center text-gray-500">Загрузка журнала…</div>;
  if (error) return <div className="py-8 text-center text-red-600">Не удалось загрузить журнал.</div>;

  const items = data?.results ?? [];
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 rounded-lg bg-gray-50">
        Пока нет записей по этой задаче.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200">
      {items.map((log: ActivityLog) => (
        <li key={log.id} className="py-3 first:pt-0">
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0" title={log.action_display}>{actionIcon(log.action)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900">
                <span className="font-medium">{log.user_display}</span>
                {' '}
                <span className="text-gray-600">{log.action_display.toLowerCase()}</span>
                {' задачу'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{formatDate(log.timestamp)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
