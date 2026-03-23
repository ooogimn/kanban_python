/**
 * SaasPlansPage — управление тарифными планами.
 *
 * АНТИГРАВИТИ [2026-03-04]:
 * Заменён raw JSON-textarea на UI-конструктор лимитов — удобная форма с именованными
 * полями. Тарифы удобно редактировать без риска сломать JSON.
 * Архитектура: всё хранится как JSON в БД — лимиты можно менять в любой момент.
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saasApi, type SaasPlan, type SaasPlanCreateUpdate } from '../../api/saas';
import { SEOMeta } from '../../components/SEOMeta';
import toast from 'react-hot-toast';

// ── Типизация лимитов ──────────────────────────────────────────────────────────
interface PlanLimits {
  max_system_contacts: number;   // -1 = без лимита, 0 = запрещено
  max_ai_agents: number;
  max_users: number;             // пользователей в workspace
  max_projects: number;
  storage_gb: number;
  features: {
    hr: boolean;
    payroll: boolean;
    ai_analyst: boolean;
    finance_analytics: boolean;
    gantt: boolean;
    api_access: boolean;
  };
}

const DEFAULT_LIMITS: PlanLimits = {
  max_system_contacts: 10,
  max_ai_agents: 1,
  max_users: 1,
  max_projects: 3,
  storage_gb: 1,
  features: {
    hr: false,
    payroll: false,
    ai_analyst: false,
    finance_analytics: false,
    gantt: false,
    api_access: false,
  },
};

function limitsFromPlan(plan: SaasPlan | null): PlanLimits {
  if (!plan) return { ...DEFAULT_LIMITS, features: { ...DEFAULT_LIMITS.features } };
  const l = plan.limits as Partial<PlanLimits>;
  const f = (l.features ?? {}) as Partial<PlanLimits['features']>;
  return {
    max_system_contacts: Number(l.max_system_contacts ?? DEFAULT_LIMITS.max_system_contacts),
    max_ai_agents: Number(l.max_ai_agents ?? DEFAULT_LIMITS.max_ai_agents),
    max_users: Number(l.max_users ?? DEFAULT_LIMITS.max_users),
    max_projects: Number(l.max_projects ?? DEFAULT_LIMITS.max_projects),
    storage_gb: Number(l.storage_gb ?? DEFAULT_LIMITS.storage_gb),
    features: {
      hr: Boolean(f.hr),
      payroll: Boolean(f.payroll),
      ai_analyst: Boolean(f.ai_analyst),
      finance_analytics: Boolean(f.finance_analytics),
      gantt: Boolean(f.gantt),
      api_access: Boolean(f.api_access),
    },
  };
}

function formatLimitInput(value: number, allowDecimal: boolean): string {
  if (value < 0) return '000';
  if (allowDecimal) return String(value);
  return String(Math.trunc(value));
}

// ── Компонент числового поля лимита ───────────────────────────────────────────
function LimitField({
  label, hint, value, onChange, allowDecimal = false,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  allowDecimal?: boolean;
}) {
  const [raw, setRaw] = useState(() => formatLimitInput(value, allowDecimal));
  useEffect(() => {
    setRaw(formatLimitInput(value, allowDecimal));
  }, [value, allowDecimal]);

  const normalize = (input: string) => input.trim().replace(',', '.');

  const commit = (input: string) => {
    const normalized = normalize(input);
    if (!normalized) {
      onChange(0);
      return;
    }
    if (normalized === '000' || normalized === '∞') {
      onChange(-1);
      return;
    }
    const parsed = allowDecimal
      ? Number.parseFloat(normalized)
      : Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed)) return;
    if (allowDecimal) {
      const rounded = Math.round(Math.max(0, parsed) * 10) / 10;
      onChange(rounded);
      return;
    }
    onChange(Math.max(0, Math.trunc(parsed)));
  };

  const handleChange = (nextRaw: string) => {
    setRaw(nextRaw);
    commit(nextRaw);
  };

  const handleBlur = () => {
    setRaw(formatLimitInput(value, allowDecimal));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1">
        {label}
        {hint && <span className="ml-1 text-slate-500 font-normal">{hint}</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          className="w-28 rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        {value < 0 && (
          <span className="text-xs text-emerald-400 font-medium">∞ без лимита</span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">000/∞ = без лимита</p>
    </div>
  );
}

// ── Компонент переключателя фичи ───────────────────────────────────────────────
function FeatureToggle({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-colors">
      <span className="text-sm text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-red-500' : 'bg-slate-600'
          }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'
            }`}
        />
      </button>
    </label>
  );
}

// ── Модальное окно создания/редактирования плана ───────────────────────────────
function PlanModal({
  plan, onClose,
}: {
  plan: SaasPlan | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  // Основные поля
  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(String(plan?.price ?? '0'));
  const [currency, setCurrency] = useState(plan?.currency ?? 'RUB');
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>('month');
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(plan?.is_default ?? false);
  const [isRecommended, setIsRecommended] = useState(plan?.is_recommended ?? false);
  const [recommendedBadge, setRecommendedBadge] = useState(plan?.recommended_badge ?? 'РЕКОМЕНДОВАН');
  const [recommendedNote, setRecommendedNote] = useState(plan?.recommended_note ?? '');
  const [description, setDescription] = useState(
    String((plan?.limits as Record<string, unknown>)?.description ?? '')
  );

  // Лимиты ресурсов
  const [limits, setLimits] = useState<PlanLimits>(limitsFromPlan(plan));

  const setLimit = <K extends keyof Omit<PlanLimits, 'features'>>(
    key: K,
    value: number
  ) => setLimits((prev) => ({ ...prev, [key]: value }));

  const setFeature = (key: keyof PlanLimits['features'], value: boolean) =>
    setLimits((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));

  const buildPayload = (): SaasPlanCreateUpdate => ({
    name: name.trim(),
    price: Number(price) || 0,
    currency,
    limits: {
      ...limits,
      billing_period: billingPeriod,
      description: description.trim(),
    },
    is_active: isActive,
    is_default: isDefault,
    is_recommended: isRecommended,
    recommended_badge: isRecommended ? (recommendedBadge.trim() || 'РЕКОМЕНДОВАН') : '',
    recommended_note: isRecommended ? recommendedNote.trim() : '',
  });

  const createMutation = useMutation({
    mutationFn: (data: SaasPlanCreateUpdate) => saasApi.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-plans'] });
      toast.success('План создан');
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SaasPlanCreateUpdate>) => saasApi.updatePlan(plan!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-plans'] });
      toast.success('План обновлён');
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (plan) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-600 bg-slate-800 shadow-2xl">
        {/* Хедер */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">
            {plan ? `Редактировать: ${plan.name}` : 'Создать тарифный план'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-6">

            {/* ── Секция 1: Основное ── */}
            <section>
              <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">
                Основное
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Название тарифа
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Free, Pro, Business, Enterprise…"
                    required
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Цена (числом)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2 text-white text-sm focus:outline-none"
                    >
                      <option value="RUB">₽ RUB</option>
                      <option value="USD">$ USD</option>
                      <option value="EUR">€ EUR</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Период оплаты
                  </label>
                  <div className="flex gap-2">
                    {(['month', 'year'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setBillingPeriod(p)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${billingPeriod === p
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                          }`}
                      >
                        {p === 'month' ? 'Месяц' : 'Год'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Описание (показывается пользователю)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Идеально для малого бизнеса…"
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
            </section>

            {/* ── Секция 2: Лимиты ресурсов ── */}
            <section>
              <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">
                Лимиты ресурсов
                <span className="ml-2 text-slate-500 normal-case font-normal text-xs">000/∞ = без лимита</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <LimitField
                  label="Пользователи в workspace"
                  value={limits.max_users}
                  onChange={(v) => setLimit('max_users', v)}
                />
                <LimitField
                  label="Проекты"
                  value={limits.max_projects}
                  onChange={(v) => setLimit('max_projects', v)}
                />
                <LimitField
                  label="CRM-контакты"
                  value={limits.max_system_contacts}
                  onChange={(v) => setLimit('max_system_contacts', v)}
                />
                <LimitField
                  label="ИИ-агенты"
                  value={limits.max_ai_agents}
                  onChange={(v) => setLimit('max_ai_agents', v)}
                />
                <LimitField
                  label="Хранилище"
                  hint="(ГБ)"
                  value={limits.storage_gb}
                  allowDecimal
                  onChange={(v) => setLimit('storage_gb', v)}
                />
              </div>
            </section>

            {/* ── Секция 3: Функции ── */}
            <section>
              <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">
                Доступные функции
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <FeatureToggle
                  label="HR-модуль"
                  checked={limits.features.hr}
                  onChange={(v) => setFeature('hr', v)}
                />
                <FeatureToggle
                  label="Расчёт зарплат (Payroll)"
                  checked={limits.features.payroll}
                  onChange={(v) => setFeature('payroll', v)}
                />
                <FeatureToggle
                  label="Финансовая аналитика"
                  checked={limits.features.finance_analytics}
                  onChange={(v) => setFeature('finance_analytics', v)}
                />
                <FeatureToggle
                  label="ИИ-аналитик"
                  checked={limits.features.ai_analyst}
                  onChange={(v) => setFeature('ai_analyst', v)}
                />
                <FeatureToggle
                  label="Gantt + Timeline"
                  checked={limits.features.gantt}
                  onChange={(v) => setFeature('gantt', v)}
                />
                <FeatureToggle
                  label="API-доступ"
                  checked={limits.features.api_access}
                  onChange={(v) => setFeature('api_access', v)}
                />
              </div>
            </section>

            {/* ── Секция 4: Статус ── */}
            <section className="space-y-4">
              <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded accent-red-500"
                />
                <span className="text-sm text-slate-200">Тариф активен</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded accent-red-500"
                />
                <span className="text-sm text-slate-200">По умолчанию (для новых пользователей)</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRecommended}
                  onChange={(e) => setIsRecommended(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span className="text-sm text-slate-200">Маркетинговая отметка (рекомендуемый)</span>
              </label>
              </div>
              <p className="text-xs text-slate-500">
                План по умолчанию может быть только один. При сохранении система автоматически снимет этот флаг у остальных.
              </p>

              {isRecommended && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Текст бейджа
                    </label>
                    <input
                      type="text"
                      value={recommendedBadge}
                      onChange={(e) => setRecommendedBadge(e.target.value)}
                      placeholder="РЕКОМЕНДОВАН / ЗВЕЗДА / MEDAL"
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Доп. подпись
                    </label>
                    <input
                      type="text"
                      value={recommendedNote}
                      onChange={(e) => setRecommendedNote(e.target.value)}
                      placeholder="для студентов / для торговли / для старта"
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}
            </section>

          </div>

          {/* Футер модального */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50 text-sm transition-colors"
            >
              {isSaving ? 'Сохранение…' : plan ? '💾 Сохранить изменения' : '✨ Создать тариф'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Бейджи фич ─────────────────────────────────────────────────────────────────
const FEATURE_LABELS: Record<string, string> = {
  hr: 'HR',
  payroll: 'Зарплата',
  ai_analyst: 'ИИ-аналит.',
  finance_analytics: 'Финансы',
  gantt: 'Gantt',
  api_access: 'API',
};

function PlanRow({
  plan,
  onEdit,
}: {
  plan: SaasPlan;
  onEdit: () => void;
}) {
  const rawLimits = plan.limits as Record<string, unknown>;
  const l = rawLimits as Partial<PlanLimits>;
  const features = (l.features ?? {}) as Partial<PlanLimits['features']>;
  const description = typeof rawLimits.description === 'string' ? rawLimits.description : null;
  const activeFeatures = Object.entries(features)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => FEATURE_LABELS[k] ?? k);

  return (
    <tr className="border-b border-slate-600/50 hover:bg-slate-700/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${plan.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          <span className="font-semibold text-white">{plan.name}</span>
          {plan.is_default && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
              по умолч.
            </span>
          )}
          {plan.is_recommended && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-400/40">
              {plan.recommended_badge || 'РЕКОМЕНДОВАН'}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5 ml-4">{description}</p>
        )}
        {plan.is_recommended && plan.recommended_note && (
          <p className="text-xs text-amber-300/80 mt-0.5 ml-4">{plan.recommended_note}</p>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        <span className="text-white font-medium">
          {Number(plan.price).toLocaleString('ru-RU')}
        </span>{' '}
        <span className="text-slate-400 text-xs">{plan.currency}</span>
      </td>
      <td className="px-4 py-3 text-slate-300 text-sm tabular-nums">
        <div className="flex flex-wrap gap-1 text-xs text-slate-400">
          {Number(l.max_users) === 0
            ? <span>👤 0</span>
            : Number(l.max_users) < 0
            ? <span>👤 ∞</span>
            : <span>👤 {l.max_users}</span>}
          {Number(l.max_projects) === 0
            ? <span>📁 0</span>
            : Number(l.max_projects) < 0
            ? <span>📁 ∞</span>
            : <span>📁 {l.max_projects}</span>}
          {Number(l.max_ai_agents) === 0
            ? <span>🤖 0</span>
            : Number(l.max_ai_agents) < 0
            ? <span>🤖 ∞</span>
            : <span>🤖 {l.max_ai_agents}</span>}
          <span>💾 {Number(l.storage_gb) < 0 ? '∞' : l.storage_gb} ГБ</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {activeFeatures.length === 0 ? (
            <span className="text-xs text-slate-600">—</span>
          ) : (
            activeFeatures.map((f) => (
              <span
                key={f}
                className="px-1.5 py-0.5 rounded text-xs bg-slate-600/50 text-slate-300"
              >
                {f}
              </span>
            ))
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onEdit}
          className="text-sm text-red-300 hover:text-red-200 transition-colors font-medium"
        >
          ✏️ Изменить
        </button>
      </td>
    </tr>
  );
}

// ── Главная страница ────────────────────────────────────────────────────────────
export default function SaasPlansPage() {
  const [modalPlan, setModalPlan] = useState<SaasPlan | null | 'create'>(null);
  const {
    data: plans = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['saas-plans'],
    queryFn: () => saasApi.getPlans(),
  });

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-300">
        Ошибка загрузки планов. Проверьте соединение или права доступа.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEOMeta
        title="Тарифные планы"
        description="Управление тарифными планами и подписками в AntExpress. Различные варианты доступа, гибкие лимиты и скидки на год."
        url="/admin/plans"
      />
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Тарифные планы</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Создавайте и редактируйте тарифы — изменения применяются сразу.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalPlan('create')}
          className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-white font-medium hover:bg-red-500 transition-colors text-sm"
        >
          <span className="text-base leading-none">+</span>
          Создать тариф
        </button>
      </div>

      {/* Подсказка о гибкости */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <span className="text-amber-400 text-lg leading-none">💡</span>
        <p className="text-xs text-amber-200/80 leading-relaxed">
          Тарифная матрица гибкая — вы можете изменить цены, лимиты и функции в любой момент.
          Изменения применяются сразу и не влияют на уже оформленные подписки до следующего продления.
          Значение <strong className="text-amber-300">000/∞</strong> в поле лимита = без ограничений.
        </p>
      </div>

      {/* Таблица */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-700/40 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-600 p-12 text-center">
          <p className="text-slate-400 mb-4">Планов пока нет. Создайте первый тариф.</p>
          <button
            type="button"
            onClick={() => setModalPlan('create')}
            className="rounded-lg bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-500 transition-colors"
          >
            + Создать тариф
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-600 bg-slate-800/80">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Название
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Цена / мес
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Лимиты
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Функции
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <PlanRow key={p.id} plan={p} onEdit={() => setModalPlan(p)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно */}
      {modalPlan !== null && (
        <PlanModal
          plan={modalPlan === 'create' ? null : modalPlan}
          onClose={() => setModalPlan(null)}
        />
      )}
    </div>
  );
}
