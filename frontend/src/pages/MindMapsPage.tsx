import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mindmapsApi, type MindMapDto } from '../api/mindmaps';
import { Plus } from 'lucide-react';

export default function MindMapsPage() {
  const { data: maps = [], isLoading } = useQuery({
    queryKey: ['mindmaps', 'personal'],
    queryFn: () => mindmapsApi.getList({ is_personal: true }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ментальные карты</h1>
        <Link
          to="/mindmaps/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Создать карту
        </Link>
      </div>

      {isLoading && (
        <p className="text-slate-500 dark:text-slate-400">Загрузка…</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(maps as MindMapDto[]).map((m) => (
          <Link
            key={m.id}
            to={`/mindmaps/${m.id}`}
            className="block p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-imperial-gold/50 hover:shadow-md transition-all"
          >
            <h2 className="font-semibold text-slate-900 dark:text-white truncate">{m.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Обновлено: {new Date(m.updated_at).toLocaleDateString('ru')}
            </p>
          </Link>
        ))}
      </div>

      {!isLoading && (maps as MindMapDto[]).length === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-8 text-center text-slate-500 dark:text-slate-400">
          Нет личных карт. Создайте первую по кнопке выше.
        </div>
      )}
    </div>
  );
}
