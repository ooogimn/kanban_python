import { useQuery } from '@tanstack/react-query';
import { financeApi, ProjectBudgetSummary } from '../../api/finance';

interface ProjectBudgetWidgetProps {
  projectId: number;
  className?: string;
}

/**
 * Форматирование суммы в рубли
 */
function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Определение цвета прогресс-бара по проценту
 */
function getProgressColor(percent: number): string {
  if (percent > 100) return 'bg-red-500';
  if (percent > 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

/**
 * Определение цвета текста процента
 */
function getPercentTextColor(percent: number): string {
  if (percent > 100) return 'text-red-600 dark:text-red-400';
  if (percent > 80) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

/**
 * Скелетон загрузки
 */
function BudgetSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded w-24" />
        <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded w-16" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-16 mb-2" />
            <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded w-24" />
          </div>
        ))}
      </div>
      <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded-full" />
    </div>
  );
}

/**
 * Сообщение об ошибке (сеть/сервер)
 */
function BudgetError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-4">
      <p className="text-red-500 dark:text-red-400 mb-2">Ошибка загрузки бюджета</p>
      <button
        onClick={onRetry}
        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
      >
        Повторить
      </button>
    </div>
  );
}

/**
 * Нет доступа к бюджету (403)
 */
function BudgetNoAccess() {
  return (
    <div className="text-center py-4">
      <p className="text-gray-500 dark:text-slate-300">
        Доступ к бюджету ограничен. Сводка доступна участникам проекта.
      </p>
    </div>
  );
}

/**
 * Проект не найден (404)
 */
function BudgetNotFound() {
  return (
    <div className="text-center py-4">
      <p className="text-gray-500 dark:text-slate-300">Нет данных по бюджету для этого проекта.</p>
    </div>
  );
}

/**
 * Виджет бюджета проекта
 */
function getErrorStatus(error: unknown): number | undefined {
  const err = error as { response?: { status?: number } };
  return err?.response?.status;
}

function isForbiddenError(error: unknown): boolean {
  return getErrorStatus(error) === 403;
}

function isNotFoundError(error: unknown): boolean {
  return getErrorStatus(error) === 404;
}

export default function ProjectBudgetWidget({ projectId, className = '' }: ProjectBudgetWidgetProps) {
  const {
    data: budget,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ProjectBudgetSummary>({
    queryKey: ['project-budget', projectId],
    queryFn: () => financeApi.getProjectSummary(projectId),
    enabled: projectId > 0,
    staleTime: 30000, // 30 секунд
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800 ${className}`}>
        <BudgetSkeleton />
      </div>
    );
  }

  if (isError) {
    const noAccess = isForbiddenError(error);
    const notFound = isNotFoundError(error);
    const neutral = noAccess || notFound;
    return (
      <div
        className={
          neutral
            ? `rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800 ${className}`
            : `rounded-xl border border-red-200 dark:border-red-800 p-4 bg-red-50 dark:bg-red-900/20 ${className}`
        }
      >
        {noAccess && <BudgetNoAccess />}
        {notFound && !noAccess && <BudgetNotFound />}
        {!neutral && <BudgetError onRetry={() => refetch()} />}
      </div>
    );
  }

  if (!budget) {
    return null;
  }

  const budgetTotal = parseFloat(budget.budget_total);
  const budgetSpent = parseFloat(budget.budget_spent);
  const remaining = parseFloat(budget.remaining);
  const percent = budget.spent_percent;
  const progressWidth = Math.min(100, percent);

  // Если бюджет не задан (0), показываем упрощённую версию
  if (budgetTotal === 0) {
    return (
      <div className={`rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Бюджет</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Бюджет проекта не задан. Укажите бюджет в настройках проекта.
        </p>
        {budget.transactions_count > 0 && (
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-2">
            Транзакций: {budget.transactions_count}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Бюджет</h2>
        <span className={`text-sm font-medium ${getPercentTextColor(percent)}`}>
          {percent}% использовано
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            Всего
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
            {formatCurrency(budgetTotal)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            Потрачено
          </p>
          <p className={`text-xl font-bold ${percent > 100 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-slate-100'}`}>
            {formatCurrency(budgetSpent)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            Остаток
          </p>
          <p className={`text-xl font-bold ${remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressColor(percent)} rounded-full transition-all duration-500`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        {percent > 100 && (
          <div className="absolute -top-1 right-0 w-1 h-5 bg-red-500 rounded" title="Превышение бюджета" />
        )}
      </div>

      {/* Additional Info */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-slate-400">
        <span>Транзакций: {budget.transactions_count}</span>
        {parseFloat(budget.hold_total) > 0 && (
          <span className="text-yellow-600 dark:text-yellow-400">
            Заморожено: {formatCurrency(budget.hold_total)}
          </span>
        )}
      </div>
    </div>
  );
}
