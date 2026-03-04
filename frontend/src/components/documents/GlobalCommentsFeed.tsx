import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { documentsApi } from '../../api/documents';
import { useAuthStore } from '../../store/authStore';

export default function GlobalCommentsFeed() {
    const { user } = useAuthStore();
    const { data: globalData, isLoading } = useQuery({
        queryKey: ['comments', 'global'],
        queryFn: () => documentsApi.getGlobalComments(),
        enabled: !!user,
    });

    const comments = globalData?.results || [];

    if (isLoading) {
        return <div className="text-center py-8 text-slate-500">Загрузка ленты...</div>;
    }

    if (comments.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <p className="text-sm">Пока нет комментариев в ваших проектах.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {comments.map((comment) => (
                <div key={comment.id} className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-imperial-gold">
                            {comment.author.username || 'User'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                            {new Date(comment.created_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 mb-2">
                        {comment.content}
                    </p>
                    <div className="flex justify-end">
                        {/* Ссылка на контекст (проект или задачу) */}
                        {comment.entity_type === 'project' && comment.object_id && (
                            <Link
                                to={`/projects/${comment.object_id}`}
                                className="text-[10px] text-primary-500 hover:underline"
                            >
                                Перейти к проекту →
                            </Link>
                        )}
                        {comment.entity_type === 'workitem' && comment.object_id && (
                            <Link
                                to={`/tasks/${comment.object_id}`}
                                className="text-[10px] text-primary-500 hover:underline"
                            >
                                Перейти к задаче →
                            </Link>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
