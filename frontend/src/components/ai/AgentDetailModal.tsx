import { Link } from 'react-router-dom';
import type { AiAgentDto } from '../../api/ai';
import { getAssetUrl } from '../../utils/assetUrl';

interface AgentDetailModalProps {
  agent: AiAgentDto;
  isHired: boolean;
  onClose: () => void;
  onHire?: () => void;
  hireLoading?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  assistant: 'Помощник',
  hr: 'HR',
  finance: 'Финансы / Бухгалтер',
  manager: 'Менеджер',
  analyst: 'Аналитик',
};

export default function AgentDetailModal({
  agent,
  isHired,
  onClose,
  onHire,
  hireLoading = false,
}: AgentDetailModalProps) {
  const roleLabel = ROLE_LABELS[agent.role] ?? agent.role;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-detail-title"
    >
      <div className="bg-white dark:bg-imperial-surface rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/10">
        {/* Шапка */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-imperial-surface">
          <h2 id="agent-detail-title" className="text-xl font-bold text-slate-900 dark:text-white">
            Учётная карточка ИИ-сотрудника
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Аватар и имя */}
          <div className="flex items-center gap-4">
            {agent.avatar_url ? (
              <img
                src={getAssetUrl(agent.avatar_url)}
                alt=""
                className="w-24 h-24 rounded-xl object-cover border-2 border-violet-500 shadow-[0_0_12px_2px_rgba(139,92,246,0.4)]"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-imperial-gold/20 text-imperial-gold flex items-center justify-center text-3xl font-bold border-2 border-violet-500">
                {agent.name.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{agent.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{roleLabel}</p>
              {agent.is_free && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  Доступен на Free
                </span>
              )}
            </div>
          </div>

          {/* Свойства */}
          <section>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Свойства
            </h4>
            <p className="text-slate-700 dark:text-slate-300">{agent.description}</p>
            <ul className="mt-2 text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>Роль: {roleLabel}</li>
              <li>Статус: {agent.is_active ? 'Активен' : 'Неактивен'}</li>
              <li>Тариф: {agent.is_free ? 'Бесплатный' : 'Pro / платный'}</li>
            </ul>
          </section>

          {/* Инструкции (system_prompt) */}
          <section>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Инструкции для ИИ
            </h4>
            <div className="rounded-xl bg-slate-100 dark:bg-white/5 p-3 text-sm text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
              {agent.system_prompt || '— Инструкции не заданы —'}
            </div>
          </section>

          {/* Преимущества */}
          <section>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Преимущества
            </h4>
            <ul className="text-slate-700 dark:text-slate-300 text-sm space-y-1 list-disc list-inside">
              <li>Работает 24/7 без перерывов</li>
              <li>Единый стиль ответов и решений</li>
              <li>Масштабируется под нагрузку</li>
              <li>Учитывает контекст вашего workspace</li>
            </ul>
          </section>

          {/* Выгода применения */}
          <section>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Выгода применения
            </h4>
            <p className="text-slate-700 dark:text-slate-300 text-sm">
              ИИ-сотрудник ведётся в команде наравне с людьми: по нему доступна статистика (чаты, задачи),
              анализ эффективности и учёт затрат. Со временем вы сможете сравнивать продуктивность и
              затраты человека и ИИ по одной методике.
            </p>
          </section>

          {/* Настройки (данные) */}
          <section>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Данные
            </h4>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-500 dark:text-slate-400">ID</dt>
              <dd className="text-slate-900 dark:text-white font-mono">{agent.id}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Роль (slug)</dt>
              <dd className="text-slate-900 dark:text-white">{agent.role}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Обновлён</dt>
              <dd className="text-slate-900 dark:text-white">
                {agent.updated_at ? new Date(agent.updated_at).toLocaleDateString('ru') : '—'}
              </dd>
            </dl>
          </section>

          {/* Действия */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
            {isHired ? (
              <Link
                to="/"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500"
              >
                Открыть чат
              </Link>
            ) : (
              onHire && (
                <button
                  type="button"
                  onClick={onHire}
                  disabled={hireLoading}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 disabled:opacity-50"
                >
                  {hireLoading ? '…' : 'Нанять в команду'}
                </button>
              )
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
