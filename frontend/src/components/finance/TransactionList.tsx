/**
 * Mobile-first transaction list (Feed view).
 * Card design: icon | description+date | amount
 */
import type { Transaction } from '../../api/finance';

function formatCurrency(value: number, currency: string): string {
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 0 })} ${currency}`;
}

function getCategoryColor(tx: Transaction): string {
  if (tx.category?.color) return tx.category.color;
  if (tx.type === 'spend' || tx.type === 'expense') return '#EF4444';
  if (tx.type === 'deposit') return '#10B981';
  if (tx.type === 'transfer') return '#0EA5E9';
  return '#64748B';
}

function getCategoryIcon(tx: Transaction): string {
  if (tx.type === 'spend' || tx.type === 'expense') return '↓';
  if (tx.type === 'deposit') return '↑';
  if (tx.type === 'transfer') return '↔';
  return '•';
}

export function TransactionList({
  transactions,
  isLoading,
  onSelectTransaction,
}: {
  transactions: Transaction[];
  isLoading: boolean;
  onSelectTransaction: (tx: Transaction) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-2xl bg-white/5 p-4 flex items-center gap-3 animate-pulse">
            <div className="w-12 h-12 rounded-xl bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 rounded bg-white/10 w-3/4" />
              <div className="h-3 rounded bg-white/5 w-1/3" />
            </div>
            <div className="h-5 rounded bg-white/10 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center text-slate-500">
        Операций нет. Нажмите + чтобы создать первую запись.
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-24">
      {transactions.map((tx) => {
        const color = getCategoryColor(tx);
        const icon = getCategoryIcon(tx);
        const isExpense = tx.type === 'spend' || tx.type === 'expense';

        return (
          <button
            key={tx.id}
            type="button"
            onClick={() => onSelectTransaction(tx)}
            className="w-full rounded-2xl border border-white/10 bg-imperial-surface/80 p-4 flex items-center gap-3 text-left active:bg-white/5 transition min-h-[72px] touch-manipulation"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-imperial-text font-medium truncate">
                {tx.description || tx.category?.name || 'Без описания'}
              </p>
              <p className="text-slate-400 text-sm">
                {new Date(tx.created_at).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {tx.has_receipt && (
                  <span className="ml-2 text-slate-500">📎</span>
                )}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={`font-semibold ${
                  isExpense ? 'text-red-300' : tx.type === 'deposit' ? 'text-emerald-300' : 'text-sky-300'
                }`}
              >
                {isExpense ? '−' : '+'}
                {formatCurrency(Number(tx.amount), tx.currency)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
