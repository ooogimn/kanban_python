import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { workspaceApi } from '../api/workspace';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
  viewer: 'Наблюдатель',
};

interface ProjectParticipantsProps {
  workspaceId: number;
}

export default function ProjectParticipants({ workspaceId }: ProjectParticipantsProps) {
  const { data: members, isLoading, error } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceMembers(workspaceId),
    enabled: workspaceId > 0,
  });

  if (isLoading) return <div className="py-8 text-center text-slate-500 dark:text-slate-400">Загрузка…</div>;
  if (error) return <div className="py-8 text-center text-red-600 dark:text-red-400">Не удалось загрузить участников.</div>;

  const list = Array.isArray(members) ? members : [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Участники пространства</h2>
        <Link
          to={`/workspaces/${workspaceId}`}
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          Управление в пространстве →
        </Link>
      </div>
      {list.length ? (
        <ul className="divide-y divide-slate-200 dark:divide-slate-600">
          {list.map((member: { id: number; user?: { username?: string; first_name?: string; last_name?: string; email?: string }; role: string }) => (
            <li key={member.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {member.user?.first_name && member.user?.last_name
                    ? `${member.user.first_name} ${member.user.last_name}`
                    : member.user?.username || 'Пользователь'}
                </p>
                {member.user?.email && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{member.user.email}</p>
                )}
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {ROLE_LABELS[member.role] || member.role}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500 dark:text-slate-400">Нет участников. Добавьте их в настройках пространства.</p>
      )}
    </div>
  );
}
