import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

/**
 * PaymentReturnPage — страница возврата после оплаты.
 * Поддерживает: Яндекс Пэй (primary) + ЮКасса (fallback).
 *
 * URL params:
 *   ?status=succeeded|pending|canceled
 *   &transaction_id=<internal_id>
 *   &provider=yandex_pay|yookassa   (опционально)
 */

type ReturnStatus = 'succeeded' | 'pending' | 'canceled' | 'unknown';

const PROVIDER_LABELS: Record<string, string> = {
    yandex_pay: 'Яндекс Пэй',
    yookassa: 'ЮКасса',
};

const STATUS_CONFIG: Record<ReturnStatus, {
    emoji: string;
    title: string;
    desc: string;
    color: string;
    glow: string;
    bg: string;
    border: string;
    primaryAction: { label: string; to: string };
    autoRedirect?: number;  // секунды
}> = {
    succeeded: {
        emoji: '✅',
        title: 'Оплата прошла успешно!',
        desc: 'Ваш тариф обновлён. Если изменения ещё не отображаются — это нормально: webhook обрабатывается асинхронно и займёт несколько секунд.',
        color: 'text-emerald-300',
        glow: 'shadow-emerald-500/20',
        bg: 'bg-emerald-500/5',
        border: 'border-emerald-500/25',
        primaryAction: { label: '→ Личный кабинет', to: '/account' },
        autoRedirect: 5,
    },
    pending: {
        emoji: '⏳',
        title: 'Платёж обрабатывается',
        desc: 'Мы получили ваш запрос на оплату. Как только банк подтвердит транзакцию — тариф обновится автоматически. Обычно это занимает несколько минут.',
        color: 'text-amber-300',
        glow: 'shadow-amber-500/20',
        bg: 'bg-amber-500/5',
        border: 'border-amber-500/25',
        primaryAction: { label: '→ Личный кабинет', to: '/account' },
    },
    canceled: {
        emoji: '↩️',
        title: 'Платёж отменён',
        desc: 'Оплата не была завершена. Деньги не списаны. Вы можете попробовать снова или выбрать другой способ оплаты.',
        color: 'text-red-300',
        glow: 'shadow-red-500/20',
        bg: 'bg-red-500/5',
        border: 'border-red-500/25',
        primaryAction: { label: '→ Выбрать тариф', to: '/account/upgrade' },
    },
    unknown: {
        emoji: '❓',
        title: 'Неизвестный статус',
        desc: 'Не удалось определить результат платежа. Проверьте историю платежей или обратитесь в поддержку.',
        color: 'text-slate-300',
        glow: 'shadow-slate-500/10',
        bg: 'bg-slate-500/5',
        border: 'border-slate-500/20',
        primaryAction: { label: '→ История платежей', to: '/account/payments' },
    },
};

// Анимированный кружок прогресса для countdown
function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
    const r = 22;
    const circ = 2 * Math.PI * r;
    const progress = (seconds / total) * circ;
    return (
        <svg width="56" height="56" viewBox="0 0 56 56" className="rotate-[-90deg]">
            <circle cx="28" cy="28" r={r} fill="none" stroke="#1e293b" strokeWidth="3" />
            <circle
                cx="28" cy="28" r={r} fill="none"
                stroke="#10b981" strokeWidth="3"
                strokeDasharray={circ}
                strokeDashoffset={circ - progress}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
            <text
                x="28" y="28"
                textAnchor="middle" dominantBaseline="central"
                fill="#6ee7b7" fontSize="13" fontWeight="bold"
                style={{ transform: 'rotate(90deg)', transformOrigin: '28px 28px' }}
            >
                {seconds}
            </text>
        </svg>
    );
}

export default function PaymentReturnPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const rawStatus = params.get('status') ?? 'unknown';
    const transactionId = params.get('transaction_id');
    const provider = params.get('provider') ?? '';

    const status: ReturnStatus = ['succeeded', 'pending', 'canceled'].includes(rawStatus)
        ? (rawStatus as ReturnStatus)
        : 'unknown';

    const cfg = STATUS_CONFIG[status];
    const providerLabel = PROVIDER_LABELS[provider] ?? null;

    // Countdown для авто-редиректа
    const [countdown, setCountdown] = useState(cfg.autoRedirect ?? 0);

    useEffect(() => {
        // Инвалидируем кеш — plan/badges обновятся в Layout и SubscriptionPage
        queryClient.invalidateQueries({ queryKey: ['my-account'] });
        queryClient.invalidateQueries({ queryKey: ['my-usage'] });
        queryClient.invalidateQueries({ queryKey: ['saas-stats'] });
    }, [queryClient]);

    useEffect(() => {
        if (!cfg.autoRedirect) return;
        if (countdown <= 0) {
            navigate('/account');
            return;
        }
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown, cfg.autoRedirect, navigate]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
            {/* Фоновый glow */}
            <div className={`fixed inset-0 pointer-events-none`}>
                {status === 'succeeded' && (
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                                    w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl" />
                )}
                {status === 'pending' && (
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                                    w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
                )}
                {status === 'canceled' && (
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                                    w-96 h-96 rounded-full bg-red-500/5 blur-3xl" />
                )}
            </div>

            <div className="relative max-w-md w-full space-y-6">
                {/* Эмодзи + заголовок */}
                <div className="text-center space-y-3">
                    <div
                        className={`inline-flex items-center justify-center w-20 h-20 rounded-full
                            text-4xl ${cfg.bg} border ${cfg.border} shadow-2xl ${cfg.glow}
                            animate-[fadeIn_0.4s_ease-out]`}
                        style={{ animation: 'bounceIn 0.5s ease-out' }}
                    >
                        {cfg.emoji}
                    </div>
                    <h1 className={`text-2xl font-bold ${cfg.color}`}>{cfg.title}</h1>
                    {providerLabel && (
                        <span className="inline-block text-xs text-slate-400 bg-slate-800/80
                                         border border-slate-700/50 rounded-full px-3 py-0.5">
                            via {providerLabel}
                        </span>
                    )}
                </div>

                {/* Карточка */}
                <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} px-6 py-5 space-y-4`}>
                    <p className="text-slate-300 text-sm leading-relaxed">{cfg.desc}</p>

                    {/* Детали транзакции */}
                    {(transactionId || providerLabel) && (
                        <div className="border-t border-slate-700/40 pt-3 space-y-1.5">
                            {providerLabel && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Провайдер</span>
                                    <span className="text-slate-300 font-medium">{providerLabel}</span>
                                </div>
                            )}
                            {transactionId && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">ID транзакции</span>
                                    <code className="text-slate-400 font-mono text-[11px]">
                                        {transactionId}
                                    </code>
                                </div>
                            )}
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Статус</span>
                                <span className={`font-medium ${cfg.color}`}>{rawStatus}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Countdown при успехе */}
                {status === 'succeeded' && cfg.autoRedirect && (
                    <div className="flex items-center justify-center gap-3 text-sm text-slate-400">
                        <CountdownRing seconds={countdown} total={cfg.autoRedirect} />
                        <span>Автопереход в кабинет...</span>
                    </div>
                )}

                {/* Кнопки действий */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                        to={cfg.primaryAction.to}
                        id="btn-payment-primary"
                        className={`flex-1 text-center px-5 py-2.5 rounded-xl text-sm font-semibold
                            transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                            ${status === 'succeeded'
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : status === 'canceled'
                                    ? 'bg-red-600 hover:bg-red-500 text-white'
                                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                            }`}
                    >
                        {cfg.primaryAction.label}
                    </Link>
                    <Link
                        to="/account/payments"
                        id="btn-payment-history"
                        className="flex-1 text-center px-5 py-2.5 rounded-xl border border-slate-600
                                   text-slate-300 text-sm hover:bg-slate-800 transition-all duration-200"
                    >
                        История платежей
                    </Link>
                </div>

                {/* Поддержка */}
                <p className="text-center text-xs text-slate-600">
                    Вопросы? Напишите в{' '}
                    <Link to="/support" className="text-slate-400 hover:text-slate-300 underline">
                        поддержку
                    </Link>
                </p>
            </div>
        </div>
    );
}
