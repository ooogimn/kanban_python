import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { accountApi, type PlanInfo } from '../../api/account';
import { COMPANY } from '../../lib/companyInfo';

// ── Типизация лимитов плана ────────────────────────────────────────────────────
interface PlanLimits {
    max_users?: number;
    max_projects?: number;
    max_system_contacts?: number;
    max_ai_agents?: number;
    storage_gb?: number;
    billing_period?: string;
    description?: string;
    features?: {
        hr?: boolean;
        payroll?: boolean;
        ai_analyst?: boolean;
        finance_analytics?: boolean;
        gantt?: boolean;
        api_access?: boolean;
    };
}

const FEATURE_LABELS: Record<string, string> = {
    hr: 'HR-модуль',
    payroll: 'Расчёт зарплат',
    finance_analytics: 'Финансовая аналитика',
    ai_analyst: 'ИИ-аналитик',
    gantt: 'Gantt + Timeline',
    api_access: 'API-доступ',
};

function fmtLimit(v: number | undefined): string {
    if (v === undefined) return '—';
    return v < 0 ? '∞' : v.toLocaleString('ru-RU');
}

function fmtPrice(plan: PlanInfo): string {
    const price = Number(plan.price);
    if (price === 0) return 'Бесплатно';
    const sym = plan.currency === 'RUB' ? '₽' : plan.currency;
    return `${price.toLocaleString('ru-RU')} ${sym}/мес`;
}

// ПЛАНЫ НА СЛУЧАЙ ЕСЛИ API ВЕРНЁТ ПУСТОЙ СПИСОК
const FALLBACK_PLANS: PlanInfo[] = [
    {
        id: 0, name: 'Free', price: '0', currency: 'RUB', is_active: true, is_default: true,
        limits: {
            max_users: 1, max_projects: 3, max_system_contacts: 10, max_ai_agents: 1, storage_gb: 1,
            features: {}
        },
    },
    {
        id: 1, name: 'Pro', price: '990', currency: 'RUB', is_active: true, is_recommended: true,
        recommended_badge: 'РЕКОМЕНДОВАН',
        recommended_note: 'для малого бизнеса',
        limits: {
            max_users: 5, max_projects: 20, max_system_contacts: 200, max_ai_agents: 3, storage_gb: 10,
            features: { hr: true, payroll: true, finance_analytics: true, gantt: true }
        },
    },
    {
        id: 2, name: 'Business', price: '2990', currency: 'RUB', is_active: true,
        limits: {
            max_users: 20, max_projects: 0, max_system_contacts: 2000, max_ai_agents: 10, storage_gb: 50,
            features: { hr: true, payroll: true, finance_analytics: true, ai_analyst: true, gantt: true, api_access: true }
        },
    },
    {
        id: 3, name: 'Enterprise', price: '0', currency: 'RUB', is_active: true,
        description: 'Договорная цена',
        limits: {
            max_users: 0, max_projects: 0, max_system_contacts: 0, max_ai_agents: 0, storage_gb: 0,
            features: { hr: true, payroll: true, finance_analytics: true, ai_analyst: true, gantt: true, api_access: true }
        },
    },
];

// ── Карточка тарифа ───────────────────────────────────────────────────────────
function PlanCard({
    plan,
    isCurrent,
    onSelect,
    isLoading,
}: {
    plan: PlanInfo;
    isCurrent: boolean;
    onSelect: (planId: number) => void;
    isLoading: boolean;
}) {
    const l = plan.limits as PlanLimits;
    const features = l.features ?? {};
    const enabledFeatures = Object.entries(FEATURE_LABELS).filter(([k]) => features[k as keyof typeof features]);
    const isEnterprise = plan.name.toLowerCase() === 'enterprise';
    const isFree = Number(plan.price) === 0 && !isEnterprise;

    return (
        <div
            className={`relative flex flex-col rounded-2xl border p-5 transition-all ${isCurrent
                ? 'border-red-500/50 bg-red-500/5 ring-1 ring-red-500/30'
                : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'
                }`}
        >
            {isCurrent && (
                <span className="absolute -top-3 left-4 px-3 py-0.5 rounded-full bg-red-600 text-white text-xs font-semibold">
                    Ваш тариф
                </span>
            )}

            {/* Заголовок */}
            <div className="mb-4">
                {plan.is_recommended && (
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                            {plan.recommended_badge || 'Рекомендуем'}
                        </span>
                        {plan.recommended_note && (
                            <span className="text-[11px] text-amber-200/90">{plan.recommended_note}</span>
                        )}
                    </div>
                )}
                <p className="text-[clamp(10px,1.2vw,12px)] font-semibold text-slate-400 uppercase tracking-widest mb-1 break-words">
                    {plan.name}
                </p>
                <p className="text-[clamp(20px,2.2vw,30px)] leading-tight font-bold text-white break-words">
                    {isEnterprise && plan.price === '0' ? 'Договорная' : fmtPrice(plan)}
                </p>
                {l.description && (
                    <p className="text-[clamp(11px,1.2vw,12px)] leading-snug text-slate-500 mt-1 break-words">
                        {l.description}
                    </p>
                )}
            </div>

            {/* Лимиты */}
            <ul className="space-y-1.5 text-[clamp(12px,1.3vw,14px)] text-slate-300 mb-4 flex-1">
                <li className="flex justify-between">
                    <span className="text-slate-500">Пользователи</span>
                    <span className="font-medium text-slate-200">{fmtLimit(l.max_users)}</span>
                </li>
                <li className="flex justify-between">
                    <span className="text-slate-500">Проекты</span>
                    <span className="font-medium text-slate-200">{fmtLimit(l.max_projects)}</span>
                </li>
                <li className="flex justify-between">
                    <span className="text-slate-500">CRM-контакты</span>
                    <span className="font-medium text-slate-200">{fmtLimit(l.max_system_contacts)}</span>
                </li>
                <li className="flex justify-between">
                    <span className="text-slate-500">ИИ-агенты</span>
                    <span className="font-medium text-slate-200">{fmtLimit(l.max_ai_agents)}</span>
                </li>
                <li className="flex justify-between">
                    <span className="text-slate-500">Хранилище</span>
                    <span className="font-medium text-slate-200">
                        {typeof l.storage_gb === 'number' && l.storage_gb < 0 ? '∞' : `${l.storage_gb ?? 1} ГБ`}
                    </span>
                </li>
            </ul>

            {/* Функции */}
            {enabledFeatures.length > 0 && (
                <div className="mb-4 pt-3 border-t border-white/5">
                    <ul className="space-y-1">
                        {enabledFeatures.map(([k, label]) => (
                            <li key={k} className="flex items-center gap-2 text-[clamp(11px,1.1vw,12px)] leading-snug text-slate-300 break-words">
                                <span className="text-emerald-400">✓</span> {label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Кнопка */}
            {isEnterprise ? (
                <a
                    href={`mailto:${COMPANY.email}?subject=Enterprise тариф`}
                    className="mt-auto block text-center px-4 py-2.5 rounded-xl border border-slate-500 text-slate-300 text-[clamp(12px,1.3vw,14px)] hover:bg-slate-700 transition-colors"
                >
                    Написать нам
                </a>
            ) : isCurrent ? (
                <button
                    type="button"
                    disabled
                    className="mt-auto block w-full text-center px-4 py-2.5 rounded-xl bg-slate-700/50 text-slate-500 text-[clamp(12px,1.3vw,14px)] cursor-not-allowed"
                >
                    Текущий тариф
                </button>
            ) : isFree ? (
                <button
                    type="button"
                    disabled
                    className="mt-auto block w-full text-center px-4 py-2.5 rounded-xl bg-slate-700/30 text-slate-500 text-[clamp(12px,1.3vw,14px)] cursor-not-allowed"
                >
                    Базовый
                </button>
            ) : (
                <button
                    id={`btn-plan-${plan.id}`}
                    type="button"
                    disabled={isLoading}
                    onClick={() => onSelect(plan.id)}
                    className="mt-auto block w-full text-center px-4 py-2.5 rounded-xl bg-red-600 text-white text-[clamp(12px,1.3vw,14px)] font-medium hover:bg-red-500 transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                    {isLoading ? (
                        <span className="inline-flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Переход...
                        </span>
                    ) : 'Подключить'}
                </button>
            )}
        </div>
    );
}

// ── Страница выбора тарифа ────────────────────────────────────────────────────
export default function UpgradePage() {
    const { data: account } = useQuery({
        queryKey: ['my-account'],
        queryFn: accountApi.getAccount,
        retry: 1,
    });

    const { data: plansData, isLoading } = useQuery({
        queryKey: ['plans-public'],
        queryFn: accountApi.getPlans,
        retry: 1,
    });

    // R2-S1/S2: мутация создания payment intent
    const [pendingPlanId, setPendingPlanId] = useState<number | null>(null);
    const [payError, setPayError] = useState<string | null>(null);

    const { mutate: startPayment } = useMutation({
        mutationFn: (planId: number) =>
            accountApi.createPaymentIntent({ plan_id: planId }),
        onSuccess: (data) => {
            // Fallback редирект → ЮКасса checkout
            window.location.href = data.confirmation_url;
        },
        onError: (err: Error) => {
            setPayError(`Ошибка при создании платежа: ${err.message}. Попробуйте позже.`);
            setPendingPlanId(null);
        },
    });

    // R2-S5: Яндекс Пэй (PRIMARY — будет активен после сдачи R2-S5 backend)
    // Используем createYandexPayment с fallback на ЮКасса при ошибке 404/500
    const { mutate: startYandexPayment, isPending: yandexPending } = useMutation({
        mutationFn: (planId: number) =>
            accountApi.createYandexPayment({ plan_id: planId }),
        onSuccess: (data) => {
            // paymentUrl от Яндекс Пэй → редирект
            window.location.href = data.confirmation_url;
        },
        onError: () => {
            // Fallback: если Я.Пэй backend ещё не готов — пробуем ЮКасса
            if (pendingPlanId !== null) {
                startPayment(pendingPlanId);
            }
        },
    });

    const paymentPending = yandexPending;

    const handleSelectPlan = (planId: number) => {
        setPayError(null);
        setPendingPlanId(planId);
        // Пробуем Яндекс Пэй первым (primary)
        startYandexPayment(planId);
    };

    const plans = plansData?.length ? plansData : FALLBACK_PLANS;
    const currentPlanId = account?.plan?.id;

    return (
        <div className="max-w-5xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-0.5">Тарифы</h1>
                <p className="text-sm text-slate-400">Выберите тариф, подходящий вашему бизнесу</p>
            </div>

            {/* Ошибка оплаты */}
            {payError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{payError}</span>
                    <button type="button" onClick={() => setPayError(null)} className="ml-auto text-red-400 hover:text-red-200">×</button>
                </div>
            )}

            {/* Заметка о гибкости */}
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/5 rounded-xl px-4 py-2.5 w-fit">
                <span>💡</span>
                <span>Тарифы можно менять в любое время. Смена применяется со следующего расчётного периода.</span>
            </div>

            {/* Сетка тарифов */}
            {isLoading ? (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-72 rounded-2xl bg-slate-700/40 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
                    {plans.filter((p) => p.is_active || p.id === 0).map((plan) => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            isCurrent={plan.id === currentPlanId}
                            onSelect={handleSelectPlan}
                            isLoading={paymentPending && pendingPlanId === plan.id}
                        />
                    ))}
                </div>
            )}

            {/* Доп. услуги */}
            <section className="pt-4">
                <h2 className="text-sm font-semibold text-white uppercase tracking-widest mb-3">
                    Дополнительные услуги
                </h2>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
                    {[
                        { icon: '🤖', name: 'Доп. ИИ-агент', price: '499 ₽/мес', desc: 'Дополнительный агент для задач' },
                        { icon: '💾', name: 'Доп. хранилище', price: '99 ₽/мес', desc: '+10 ГБ к текущему тарифу' },
                        { icon: '👤', name: 'Доп. пользователь', price: '299 ₽/мес', desc: '+1 место в workspace' },
                        { icon: '🎯', name: 'Приоритетная поддержка', price: '1 990 ₽/мес', desc: 'SLA 4 часа, выделенный менеджер' },
                        { icon: '⚙️', name: 'Персональная настройка', price: '9 900 ₽', desc: 'Разовая настройка под ваш бизнес' },
                    ].map((addon) => (
                        <div
                            key={addon.name}
                            className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 min-w-0 overflow-hidden"
                        >
                            <div className="flex gap-3 min-w-0 flex-1">
                                <span className="text-xl">{addon.icon}</span>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-white break-words">{addon.name}</p>
                                    <p className="text-xs text-slate-500 break-words">{addon.desc}</p>
                                </div>
                            </div>
                            <div className="text-left sm:text-right sm:shrink-0 sm:ml-2">
                                <p className="text-sm font-semibold text-slate-200 break-words sm:whitespace-nowrap">{addon.price}</p>
                                <button
                                    type="button"
                                    onClick={() => alert(`Подключение: ${addon.name} (в разработке)`)}
                                    className="text-xs text-red-400 hover:text-red-300 transition-colors mt-1"
                                >
                                    Подключить →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Контакты для Enterprise */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <p className="font-semibold text-white">Нужно индивидуальное решение?</p>
                    <p className="text-sm text-slate-400">
                        Enterprise-тариф, корпоративный договор или 100+ пользователей — свяжитесь с нами.
                    </p>
                </div>
                <a
                    href={`mailto:${COMPANY.email}?subject=Enterprise`}
                    className="shrink-0 px-5 py-2.5 rounded-xl border border-slate-500 text-slate-200 text-sm hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                    Написать нам
                </a>
            </div>
        </div>
    );
}
