import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountApi, type Payment, type Invoice, type PaymentStatus, type InvoiceStatus } from '../../api/account';

// ── Хелперы ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatAmount(amount: string, currency: string): string {
    const num = Number(amount);
    const sym = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency;
    return `${num.toLocaleString('ru-RU')} ${sym}`;
}

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
    pending: { label: 'Ожидает', cls: 'text-yellow-400' },
    completed: { label: 'Оплачен', cls: 'text-emerald-400' },
    failed: { label: 'Ошибка', cls: 'text-red-400' },
    refunded: { label: 'Возврат', cls: 'text-slate-400' },
};

const INVOICE_STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
    draft: { label: 'Черновик', cls: 'text-slate-500' },
    issued: { label: 'Выставлен', cls: 'text-blue-400' },
    paid: { label: 'Оплачен', cls: 'text-emerald-400' },
    overdue: { label: 'Просрочен', cls: 'text-red-400' },
    cancelled: { label: 'Отменён', cls: 'text-slate-500' },
};

// ── Строка платежа ─────────────────────────────────────────────────────────────
function PaymentRow({ p }: { p: Payment }) {
    const s = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.pending;
    return (
        <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
            <td className="px-4 py-3 text-sm text-slate-300">{formatDate(p.created_at)}</td>
            <td className="px-4 py-3 text-sm text-slate-200">{p.description || '—'}</td>
            <td className={`px-4 py-3 text-sm font-medium ${s.cls}`}>{s.label}</td>
            <td className="px-4 py-3 text-sm text-white font-medium text-right tabular-nums">
                {formatAmount(p.amount, p.currency)}
            </td>
            <td className="px-4 py-3 text-right">
                {p.invoice_url ? (
                    <a
                        href={p.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        📄 Счёт
                    </a>
                ) : (
                    <span className="text-xs text-slate-600">—</span>
                )}
            </td>
        </tr>
    );
}

// ── Строка счёта ───────────────────────────────────────────────────────────────
function InvoiceRow({ inv }: { inv: Invoice }) {
    const s = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.draft;
    return (
        <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
            <td className="px-4 py-3 text-sm text-slate-400 font-mono">#{inv.number}</td>
            <td className="px-4 py-3 text-sm text-slate-300">{formatDate(inv.issued_at)}</td>
            <td className="px-4 py-3 text-sm text-slate-300">{formatDate(inv.due_at)}</td>
            <td className={`px-4 py-3 text-sm font-medium ${s.cls}`}>{s.label}</td>
            <td className="px-4 py-3 text-sm text-white font-medium text-right tabular-nums">
                {formatAmount(inv.amount, inv.currency)}
            </td>
            <td className="px-4 py-3 text-right">
                {inv.pdf_url ? (
                    <a
                        href={inv.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        ⬇️ PDF
                    </a>
                ) : (
                    <span className="text-xs text-slate-600">—</span>
                )}
            </td>
        </tr>
    );
}

// ── Главная страница ───────────────────────────────────────────────────────────
export default function PaymentsPage() {
    const [tab, setTab] = useState<'payments' | 'invoices'>('payments');

    const {
        data: paymentsData,
        isLoading: loadingPayments,
        error: errPayments,
    } = useQuery({
        queryKey: ['my-payments'],
        queryFn: () => accountApi.getPayments(),
        retry: 1,
        enabled: tab === 'payments',
    });

    const {
        data: invoices,
        isLoading: loadingInvoices,
        error: errInvoices,
    } = useQuery({
        queryKey: ['my-invoices'],
        queryFn: accountApi.getInvoices,
        retry: 1,
        enabled: tab === 'invoices',
    });

    const payments = paymentsData?.results ?? [];
    const isLoading = tab === 'payments' ? loadingPayments : loadingInvoices;
    const hasError = tab === 'payments' ? !!errPayments : !!errInvoices;

    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-0.5">Финансы</h1>
                <p className="text-sm text-slate-400">История платежей и счетов</p>
            </div>

            {/* Табы */}
            <div className="flex gap-1 p-1 rounded-xl bg-slate-700/50 w-fit">
                {(['payments', 'invoices'] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t
                                ? 'bg-slate-900 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        {t === 'payments' ? '💰 Платежи' : '📄 Счета'}
                    </button>
                ))}
            </div>

            {/* Контент */}
            {hasError ? (
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
                    <p className="text-yellow-300 text-sm font-medium mb-1">⏳ API в разработке</p>
                    <p className="text-yellow-200/70 text-xs">
                        Cursor AI завершает R1-S3. История платежей появится после деплоя.
                    </p>
                </div>
            ) : isLoading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-12 rounded-xl bg-slate-700/40 animate-pulse" />
                    ))}
                </div>
            ) : tab === 'payments' ? (
                payments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-600 p-10 text-center">
                        <p className="text-slate-500 text-sm">Платежей пока нет.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5">
                                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase tracking-wide">Дата</th>
                                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase tracking-wide">Описание</th>
                                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase tracking-wide">Статус</th>
                                    <th className="px-4 py-3 text-right text-xs text-slate-400 font-semibold uppercase tracking-wide">Сумма</th>
                                    <th className="px-4 py-3 text-right text-xs text-slate-400 font-semibold uppercase tracking-wide">Документ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p) => <PaymentRow key={p.id} p={p} />)}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                !invoices?.length ? (
                    <div className="rounded-xl border border-dashed border-slate-600 p-10 text-center">
                        <p className="text-slate-500 text-sm">Счетов пока нет.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5">
                                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase tracking-wide">Номер</th>
                                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase tracking-wide">Выставлен</th>
                                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase tracking-wide">До, оплаты</th>
                                    <th className="px-4 py-3 text-left text-xs text-slate-400 font-semibold uppercase tracking-wide">Статус</th>
                                    <th className="px-4 py-3 text-right text-xs text-slate-400 font-semibold uppercase tracking-wide">Сумма</th>
                                    <th className="px-4 py-3 text-right text-xs text-slate-400 font-semibold uppercase tracking-wide">PDF</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}
                            </tbody>
                        </table>
                    </div>
                )
            )}
        </div>
    );
}
