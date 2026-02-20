import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../../types';
import { aiApi } from '../../api/ai';

interface ProjectHeaderProps {
  project: Project;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

const HEALTH_LABELS: Record<string, string> = {
  on_track: 'On Track',
  behind: 'Behind',
};

export default function ProjectHeader({
  project,
  onEdit,
  onDelete,
  isDeleting = false,
}: ProjectHeaderProps) {
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ summary: string; context: unknown } | null>(null);
  const [aiShowContext, setAiShowContext] = useState(false);

  const progress = project.progress ?? 0;
  const healthStatus = project.health_status ?? 'on_track';
  const isBehind = healthStatus === 'behind';

  const handleAiSummary = async () => {
    setAiModalOpen(true);
    setAiResult(null);
    setAiShowContext(false);
    setAiLoading(true);
    try {
      const data = await aiApi.analyzeProject(project.id);
      setAiResult({ summary: data.summary, context: data.context });
    } catch {
      setAiResult({ summary: 'Не удалось загрузить сводку.', context: null });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            to="/projects"
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 mb-2 inline-block"
          >
            ← Назад к проектам
          </Link>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-imperial-surface shrink-0 overflow-hidden flex items-center justify-center border border-white/5">
              {project.logo_url ? (
                <img src={project.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-400">📁</span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-imperial-text">{project.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {project.start_date && (
                  <span className="text-sm text-gray-500 dark:text-imperial-muted">
                    {new Date(project.start_date).toLocaleDateString('ru-RU')}
                  </span>
                )}
                {project.start_date && project.end_date && (
                  <span className="text-slate-400">—</span>
                )}
                {project.end_date && (
                  <span className="text-sm text-gray-500 dark:text-imperial-muted">
                    {new Date(project.end_date).toLocaleDateString('ru-RU')}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${isBehind
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}
                  title={HEALTH_LABELS[healthStatus] ?? healthStatus}
                >
                  {isBehind ? '🔴' : '🔵'} {HEALTH_LABELS[healthStatus] ?? healthStatus}
                </span>
              </div>
            </div>
          </div>
          {project.description && (
            <p className="text-gray-600 dark:text-imperial-muted mt-2">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAiSummary}
            disabled={aiLoading}
            className="px-4 py-2 rounded-lg bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40 hover:bg-imperial-gold/30 transition-colors disabled:opacity-50 flex items-center gap-2"
            title="AI сводка по проекту"
          >
            ✨ AI Summary
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 dark:bg-imperial-neon dark:hover:opacity-90"
            >
              Редактировать
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Удалить
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-100 dark:bg-imperial-surface border border-white/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-imperial-text">Прогресс проекта</span>
          <span className="text-sm text-gray-500 dark:text-imperial-muted">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 dark:bg-imperial-gold rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      {aiModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAiModalOpen(false)}
        >
          <div
            className="rounded-xl border border-white/10 bg-imperial-surface dark:bg-imperial-surface w-full max-w-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">✨ AI Summary</h3>
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="p-2 rounded-lg text-imperial-muted hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {aiLoading ? (
                <p className="text-imperial-muted">Загрузка…</p>
              ) : aiResult ? (
                <div className="space-y-4">
                  <p className="text-slate-200 leading-relaxed">{aiResult.summary}</p>
                  <div>
                    <button
                      type="button"
                      onClick={() => setAiShowContext((v) => !v)}
                      className="text-sm text-imperial-gold hover:underline"
                    >
                      {aiShowContext ? 'Скрыть контекст' : 'Показать контекст'}
                    </button>
                    {aiShowContext && aiResult.context && (
                      <pre className="mt-2 p-3 rounded-lg bg-white/5 text-xs text-imperial-muted overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(aiResult.context, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
