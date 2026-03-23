/**
 * API Личного Кабинета (ЛК).
 *
 * R1-S4 DONE (7 passed) — эндпоинты согласованы с Cursor AI [2026-03-04]:
 *   GET  /api/v1/billing/account/me/              — подписка + entitlements + status_flags
 *   GET  /api/v1/billing/usage/me/                — usage meters + totals
 *   GET  /api/v1/billing/cabinet/payments/me/     — платежи
 *   GET  /api/v1/billing/cabinet/invoices/me/     — счета
 *   GET  /api/v1/billing/cabinet/timeline/me/     — объединённая лента
 *
 * R2-S1/S2 DONE (9 passed) — провайдеры оплаты:
 *   POST /api/v1/billing/provider/yandex-pay/create-payment/ — Я.Пэй PRIMARY (R2-S5)
 *   POST /api/v1/billing/provider/yookassa/create-payment-intent/ — ЮКасса fallback
 *   POST /api/v1/billing/provider/yandex-pay/webhook/         — webhook Я.Пэй
 *   POST /api/v1/billing/provider/yookassa/webhook/           — webhook ЮКасса
 *
 * Страница возврата после оплаты: /account/payment-return?status=succeeded|pending|canceled
 */
import api from './client';


// ── Entitlements (доступ по подписке) ─────────────────────────────────────────
export type AccessMode = 'full' | 'limited' | 'blocked' | 'trial';

export interface EntitlementLimits {
    max_system_contacts?: number;
    max_ai_agents?: number;
    max_users?: number;
    max_projects?: number;
    storage_gb?: number;
    [key: string]: number | undefined;
}

export interface EntitlementFeatures {
    hr?: boolean;
    payroll?: boolean;
    ai_analyst?: boolean;
    finance_analytics?: boolean;
    gantt?: boolean;
    api_access?: boolean;
    [key: string]: boolean | undefined;
}

export interface EntitlementRestrictions {
    reason?: string;
    message?: string;
    blocked_at?: string;
}

export interface EntitlementPeriod {
    start: string | null;
    end: string | null;
    trial_end: string | null;
    days_left: number | null;
}

export interface Entitlement {
    source: 'subscription' | 'free' | 'trial' | 'override' | 'none';
    access_mode: AccessMode;
    limits: EntitlementLimits;
    features: EntitlementFeatures;
    restrictions: EntitlementRestrictions | null;
    period: EntitlementPeriod;
}

// ── Подписка ──────────────────────────────────────────────────────────────────
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired' | 'none';

export interface PlanInfo {
    id: number;
    name: string;
    price: string;
    currency: string;
    limits: Record<string, unknown>;
    is_active: boolean;
    description?: string;
    billing_period?: 'month' | 'year';
}

export interface MyAccount {
    // ── Подписка ──
    subscription_id: number | null;
    status: SubscriptionStatus;
    plan: PlanInfo | null;
    started_at: string | null;
    expires_at: string | null;
    auto_renew: boolean;
    cancelled_at: string | null;
    entitlement: Entitlement;
    // ── Новые поля R1-S4 [Cursor AI 2026-03-04 02:30] ──
    account_status?: string;              // статус: 'active' | 'trialing' | ...
    account_currency?: string;            // 'RUB' | 'USD'
    account_timezone?: string;            // 'Europe/Moscow'
    plan_interval?: 'month' | 'year';     // период биллинга
    plan_price?: string;                  // цена тарифа
    plan_currency?: string;               // валюта тарифа
    plan_badge?: string;                  // напр. 'PRO', 'BUSINESS'
    cancel_at_period_end?: boolean;       // отмена в конце периода
    trial_end?: string | null;            // дата окончания трайала
    provider?: string;                    // 'yookassa' | 'yandex_pay' | 'manual'
    provider_subscription_id?: string;   // ID подписки у провайдера
    next_billing_at?: string | null;      // следующее списание
    // ─ Новые поля R1-S5 [Cursor AI 2026-03-04 02:55] ─
    provider_display?: string;            // 'ЮКасса' | 'Яндекс Пэй' | 'Ручная оплата' (человекочитаемое)
    status_flags?: {
        is_trial: boolean;                // пробный период
        in_grace: boolean;               // грейс (подписка просрочена, доступ ещё есть)
        is_read_only: boolean;           // только чтение (заблокировано)
        will_cancel_at_period_end: boolean; // отмена в конце периода
    };
}

// ── Usage (использование ресурсов) ────────────────────────────────────────────
export interface UsageMeter {
    key: string;           // напр. "system_contacts", "ai_agents", "storage_gb"
    label: string;         // напр. "CRM-контакты"
    used: number;
    limit: number;         // 0 = без лимита
    unit?: string;         // напр. "ГБ", "шт."
    pct?: number;          // процент использования 0-100
}

export interface MyUsage {
    period_start: string;
    period_end: string;
    meters: UsageMeter[];
    totals: Record<string, number>;
}

// ── Timeline (объединённая лента событий) ────────────────────────────────────
export type TimelineItemType = 'payment' | 'invoice' | 'subscription' | 'trial';

export interface TimelineItem {
    id: string;          // уникальный ключ в ленте
    type: TimelineItemType;
    date: string;
    title: string;
    amount: string | null;
    currency: string | null;
    status: string;
    detail_url: string | null;
}

// ── Платежи ───────────────────────────────────────────────────────────────────
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
    id: number;
    amount: string;
    currency: string;
    status: PaymentStatus;
    description: string;
    created_at: string;
    paid_at: string | null;
    invoice_url: string | null;
}

// ── Счета ─────────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
    id: number;
    number: string;
    status: InvoiceStatus;
    amount: string;
    currency: string;
    issued_at: string | null;
    due_at: string | null;
    paid_at: string | null;
    pdf_url: string | null;
}

// ── API вызовы ────────────────────────────────────────────────────────────────
export const accountApi = {
    /** Текущая подписка + entitlements пользователя */
    getAccount: async (): Promise<MyAccount> => {
        const res = await api.get('/billing/account/me/');
        return res.data;
    },

    /** Usage: использование ресурсов за текущий период */
    getUsage: async (): Promise<MyUsage> => {
        const res = await api.get('/billing/usage/me/');
        return res.data;
    },

    /** История платежей — cabinet/payments/me/ */
    getPayments: async (page = 1): Promise<{ results: Payment[]; count: number }> => {
        const res = await api.get('/billing/cabinet/payments/me/', { params: { page } });
        return res.data;
    },

    /** Счета — cabinet/invoices/me/ */
    getInvoices: async (): Promise<Invoice[]> => {
        const res = await api.get('/billing/cabinet/invoices/me/');
        return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    },

    /** Объединённая лента платежи + счета — cabinet/timeline/me/ */
    getTimeline: async (): Promise<TimelineItem[]> => {
        const res = await api.get('/billing/cabinet/timeline/me/');
        return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    },

    /** Отмена подписки */
    cancelSubscription: async (): Promise<{ cancelled: boolean }> => {
        const res = await api.post('/billing/account/me/cancel/');
        return res.data;
    },

    /** Публичный список активных тарифов для апгрейд-страницы */
    getPlans: async (): Promise<PlanInfo[]> => {
        const res = await api.get('/saas/plans/');
        return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    },

    // ── R2-S1/S2: ЮКасса PaymentIntent (FALLBACK) ───────────────────────────

    /**
     * Создать платёжное намерение (ЮКасса) — FALLBACK провайдер.
     * POST /api/v1/billing/provider/yookassa/create-payment-intent/
     */
    createPaymentIntent: async (payload: {
        plan_id: number;
        return_url?: string;
    }): Promise<PaymentIntent> => {
        const res = await api.post('/billing/provider/yookassa/create-payment-intent/', payload);
        return res.data;
    },

    // ── R2-S5: Яндекс Пэй (PRIMARY) ─────────────────────────────────────────

    /**
     * Создать платёж через Яндекс Пэй — PRIMARY провайдер.
     * POST /api/v1/billing/provider/yandex-pay/create-payment/
     *
     * Возвращает paymentUrl (= confirmation_url) — куда редиректить пользователя.
     * Merchant API: POST https://pay.yandex.ru/api/merchant/v1/orders
     */
    createYandexPayment: async (payload: {
        plan_id: number;
        return_url?: string;
    }): Promise<YandexPayOrder> => {
        const res = await api.post('/billing/provider/yandex-pay/create-payment/', payload);
        return res.data;
    },
};

// ── R2: PaymentIntent (ЮКасса fallback) ──────────────────────────────────────
export type PaymentIntentStatus =
    | 'pending'
    | 'waiting_for_capture'
    | 'succeeded'
    | 'canceled';

export interface PaymentIntent {
    transaction_id: string;        // наш внутренний ID
    provider_payment_id: string;   // ID платежа у ЮКассы
    status: PaymentIntentStatus;
    amount: string;
    currency: string;
    confirmation_url: string;      // URL для редиректа → ЮКасса checkout
    return_url: string;
    idempotency_key: string;
    created_at: string;
    expires_at: string | null;
}

// ── R2-S5: Яндекс Пэй (PRIMARY) ──────────────────────────────────────────────
export type YandexPayOrderStatus =
    | 'PENDING'
    | 'AUTHORIZED'
    | 'CAPTURED'
    | 'VOIDED'
    | 'REFUNDED'
    | 'PARTIALLY_REFUNDED';

export interface YandexPayOrder {
    transaction_id: string;        // наш внутренний ID
    provider_order_id: string;     // orderId от Яндекс Пэй
    status: YandexPayOrderStatus;
    amount: string;
    currency: string;
    confirmation_url: string;      // paymentUrl → редирект на форму Яндекс Пэй
    return_url: string;
    created_at: string;
    expires_at: string | null;
}
