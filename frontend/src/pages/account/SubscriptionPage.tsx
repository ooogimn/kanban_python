import { useQuery } from '@tanstack/react-query';
import { accountApi, type MyAccount, type AccessMode } from '../../api/account';
import { Link } from 'react-router-dom';

// ── Хелперы ───────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    active: { label: 'Активна', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    trialing: { label: 'Пробный', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    past_due: { label: 'Просрочена', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    cancelled: { label: 'Отменена', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    expired: { label: 'Истекла', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    none: { label: 'Нет', cls: 'bg-slate-600/20 text-slate-500 border-slate-600/30' },
};

const ACCESS_LABEL: Record<AccessMode, string> = {
    full: '✅ Полный доступ',
    limited: '⚠️ Ограниченный',
    blocked: '🚫 Заблокирован',
    trial: '🎁 Пробный период',
};

const PROVIDER_LABEL: Record<string, string> = {
    yookassa: '🏦 ЮКасса',
    yandex_pay: '💛 Яндекс Пэй',
    manual: '📝 Ручная оплата',
    stripe: '💳 Stripe',
};

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtPrice(price: string | undefined, currency: string | undefined, interval: 'month' | 'year' | undefined): string {
    if (!price) return '';
    const num = Number(price);
    const sym = currency === 'RUB' ? '₽' : currency ?? '';
    const period = interval === 'year' ? '/год' : '/мес';
    return `${num.toLocaleString('ru-RU')} ${sym}${period}`;
}

// ── Карточка статуса подписки (R1-S4/S5 fields) ──────────────────────────────
function SubscriptionCard({ account }: { account: MyAccount }) {
    const status = STATUS_LABEL[account.status] ?? STATUS_LABEL.none;
    const { period, access_mode, restrictions } = account.entitlement;

    // Используем status_flags от R1-S5 (приоритет), с fallback на старые поля
    const flags = account.status_flags;
    const willCancel = flags?.will_cancel_at_period_end ?? account.cancel_at_period_end ?? false;
    const inGrace = flags?.in_grace ?? false;
    const isReadOnly = flags?.is_read_only ?? (access_mode === 'blocked');
    const isTrial = flags?.is_trial ?? (account.status === 'trialing');

    // provider_display от R1-S5 (человекочитаемое) или fallback на старый маппинг
    const providerLabel = account.provider_display
        ?? PROVIDER_LABEL[account.provider ?? '']
        ?? account.provider
        ?? '';

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            {/* Заголовок */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <p className="text-xs text-slate-400 mb-1">Текущий тариф</p>
                    <div className="flex items-center gap-2">
                        <p className="text-xl font-bold text-white">
                            {account.plan?.name ?? 'Бесплатный'}
                        </p>
                        {account.plan_badge && (
                            <span className="px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500/40 text-red-300 text-[10px] font-bold uppercase tracking-widest">
                                {account.plan_badge}
                            </span>
                        )}
                        {account.plan_price && (
                            <span className="text-sm text-slate-400">
                                {fmtPrice(account.plan_price, account.plan_currency, account.plan_interval)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${status.cls}`}>
                        {status.label}
                    </span>
                    <span className="text-xs text-slate-400">{ACCESS_LABEL[access_mode]}</span>
                </div>
            </div>

            {/* Предупреждение об отмене */}
            {willCancel && (
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm text-orange-300 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>
                        Подписка отменена и будет деактивирована в конце периода{period.end ? ` (${formatDate(period.end)})` : ''}.
                        {' '}<Link to="/account/upgrade" className="underline hover:text-orange-200">Возобновить →</Link>
                    </span>
                </div>
            )}

            {/* Grace-период (R2-S4: Celery grace → read_only) */}
            {inGrace && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-300 flex items-start gap-2">
                    <span>🕐</span>
                    <span>
                        Период ожидания оплаты. Доступ временно сохранён, пожалуйста оплатите счёт.
                        {' '}<Link to="/account/payments" className="underline hover:text-yellow-200">Перейти к оплате →</Link>
                    </span>
                </div>
            )}

            {/* Режим только-чтение (R2-S4: read_only) */}
            {isReadOnly && !inGrace && (
                <div className="rounded-lg border border-red-600/40 bg-red-600/10 px-4 py-2.5 text-sm text-red-300 flex items-start gap-2">
                    <span>🔒</span>
                    <span>
                        Доступ ограничен — только просмотр. Для восстановления полного доступа продлите подписку.
                        {' '}<Link to="/account/upgrade" className="underline hover:text-red-200">Продлить →</Link>
                    </span>
                </div>
            )}

            {/* Детали периода */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                    <p className="text-slate-500 text-xs">Начало</p>
                    <p className="text-slate-200">{formatDate(period.start)}</p>
                </div>
                <div>
                    <p className="text-slate-500 text-xs">{willCancel ? 'Действует до' : 'Следующий платёж'}</p>
                    <p className="text-slate-200">
                        {account.next_billing_at ? formatDate(account.next_billing_at) : formatDate(period.end)}
                    </p>
                </div>
                {period.days_left !== null && (
                    <div>
                        <p className="text-slate-500 text-xs">Осталось дней</p>
                        <p className={`font-semibold ${period.days_left <= 5 ? 'text-orange-400' : 'text-white'}`}>
                            {period.days_left}
                        </p>
                    </div>
                )}
                {providerLabel && (
                    <div>
                        <p className="text-slate-500 text-xs">Способ оплаты</p>
                        <p className="text-slate-200 text-xs">{providerLabel}</p>
                    </div>
                )}
            </div>

            {/* Пробный период */}
            {isTrial && account.trial_end && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-2 text-xs text-blue-300">
                    🎁 Пробный период до: <strong>{formatDate(account.trial_end)}</strong>
                </div>
            )}

            {/* Ограничения */}
            {restrictions?.message && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                    ⚠️ {restrictions.message}
                </div>
            )}

            {/* Кнопки */}
            <div className="flex flex-wrap gap-2 pt-1">
                <Link
                    to="/account/upgrade"
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
                >
                    🚀 Сменить тариф
                </Link>
                <Link
                    to="/account/payments"
                    className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                >
                    История платежей
                </Link>
            </div>
        </div>
    );
}

// ── Прогресс использования ────────────────────────────────────────────────────
function UsageBar({ label, used, limit, unit }: { label: string; used: number; limit: number; unit?: string }) {
    const unlimited = limit === 0;
    const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
    const danger = !unlimited && pct >= 90;
    const warn = !unlimited && pct >= 70;

    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">{label}</span>
                <span className={`font-medium ${danger ? 'text-red-400' : warn ? 'text-orange-400' : 'text-slate-400'}`}>
                    {unlimited
                        ? `${used.toLocaleString('ru-RU')} / ∞`
                        : `${used.toLocaleString('ru-RU')} / ${limit.toLocaleString('ru-RU')}${unit ? ` ${unit}` : ''}`}
                </span>
            </div>
            {!unlimited && (
                <div className="h-1.5 rounded-full bg-slate-700">
                    <div
                        className={`h-full rounded-full transition-all ${danger ? 'bg-red-500' : warn ? 'bg-orange-500' : 'bg-red-500/70'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
        </div>
    );
}

// ── Страница "Подписка и использование" ───────────────────────────────────────
export default function SubscriptionPage() {
    const {
        data: account,
        isLoading: loadingAccount,
        error: errorAccount,
    } = useQuery({
        queryKey: ['my-account'],
        queryFn: accountApi.getAccount,
        retry: 1,
    });

    const {
        data: usage,
        isLoading: loadingUsage,
    } = useQuery({
        queryKey: ['my-usage'],
        queryFn: accountApi.getUsage,
        retry: 1,
        enabled: !!account,
    });

    if (loadingAccount) {
        return (
            <div className="space-y-4 max-w-2xl">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-28 rounded-2xl bg-slate-700/40 animate-pulse" />
                ))}
            </div>
        );
    }

    if (errorAccount || !account) {
        return (
            <div className="max-w-2xl space-y-4">
                <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
                    <p className="text-yellow-300 text-sm font-medium mb-1">⏳ Подключение к API...</p>
                    <p className="text-yellow-200/70 text-xs">
                        API ЛК готов (R1-S4 DONE). Проверьте авторизацию или перезагрузите страницу.
                    </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4 opacity-40 pointer-events-none">
                    <div className="h-6 w-32 bg-slate-600 rounded animate-pulse" />
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-700 rounded animate-pulse" />)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-0.5">Подписка</h1>
                <p className="text-sm text-slate-400">Управление тарифом и использование ресурсов</p>
            </div>

            {/* Карточка подписки — использует поля R1-S4 */}
            <SubscriptionCard account={account} />

            {/* Использование ресурсов */}
            <section>
                <h2 className="text-sm font-semibold text-white uppercase tracking-widest mb-3">
                    Использование ресурсов
                </h2>
                {loadingUsage ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-8 rounded bg-slate-700/40 animate-pulse" />
                        ))}
                    </div>
                ) : usage?.meters?.length ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                        {usage.period_start && (
                            <p className="text-xs text-slate-500">
                                Период: {formatDate(usage.period_start)} — {formatDate(usage.period_end)}
                            </p>
                        )}
                        <div className="space-y-3">
                            {usage.meters.map((m) => (
                                <UsageBar key={m.key} label={m.label} used={m.used} limit={m.limit} unit={m.unit} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-slate-500 text-sm">Данные об использовании недоступны.</p>
                )}
            </section>

            {/* Функции тарифа */}
            {account.entitlement.features && Object.keys(account.entitlement.features).length > 0 && (
                <section>
                    <h2 className="text-sm font-semibold text-white uppercase tracking-widest mb-3">
                        Функции вашего тарифа
                    </h2>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(account.entitlement.features).map(([key, enabled]) => (
                                <div
                                    key={key}
                                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${enabled ? 'text-white' : 'text-slate-600'}`}
                                >
                                    <span>{enabled ? '✅' : '❌'}</span>
                                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Техническая информация для дебага (только в dev) */}
            {import.meta.env.DEV && (
                <details className="text-xs">
                    <summary className="text-slate-600 cursor-pointer hover:text-slate-400">
                        🔧 Debug: детали аккаунта
                    </summary>
                    <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-400 overflow-x-auto text-[10px]">
                        {JSON.stringify({ provider: account.provider, next_billing_at: account.next_billing_at, account_timezone: account.account_timezone }, null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );
}
