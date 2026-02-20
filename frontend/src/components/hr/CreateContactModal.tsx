import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../../api/workspace';
import { hrApi } from '../../api/hr';
import type { Contact, ContactCreatePayload } from '../../types/hr';
import toast from 'react-hot-toast';

function getApiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  const d = data as Record<string, unknown>;
  if (typeof d.detail === 'string') return d.detail;
  if (Array.isArray(d.detail) && d.detail[0]) return String(d.detail[0]);
  return fallback;
}

interface CreateContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
  superGroup: 'SYSTEM' | 'NON_SYSTEM';
  contact?: Contact | null;
  onSuccess?: (contact: Contact) => void;
}

type TabId = 'profile' | 'finance';

export default function CreateContactModal({
  isOpen,
  onClose,
  workspaceId,
  superGroup,
  contact,
  onSuccess,
}: CreateContactModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const isEdit = !!contact;

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    group: superGroup === 'SYSTEM' ? 'staff' : 'client',
    hr_role: '',
    guarantor: null as number | null,
    tariff_rate: '' as string | number,
    currency: 'RUB',
  });

  useEffect(() => {
    if (contact) {
      setForm({
        first_name: contact.first_name ?? '',
        last_name: contact.last_name ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
        group: contact.group ?? (superGroup === 'SYSTEM' ? 'staff' : 'client'),
        hr_role: contact.hr_role ?? '',
        guarantor: contact.guarantor,
        tariff_rate: contact.tariff_rate ?? '',
        currency: contact.currency ?? 'RUB',
      });
    } else {
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        group: superGroup === 'SYSTEM' ? 'staff' : 'client',
        hr_role: '',
        guarantor: null,
        tariff_rate: '',
        currency: 'RUB',
      });
    }
  }, [contact, superGroup, isOpen]);

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceMembers(workspaceId),
    enabled: isOpen && workspaceId > 0,
  });

  const members = Array.isArray(membersData) ? membersData : [];
  const guarantorOptions = members.filter((m: { user?: { id?: number } }) => m.user?.id);

  const createMutation = useMutation({
    mutationFn: (payload: ContactCreatePayload) => hrApi.createContact(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', workspaceId] });
      toast.success('Контакт создан');
      onSuccess?.(data);
      onClose();
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'LIMIT_REACHED') {
        return;
      }
      toast.error(getApiErrorMessage(err, 'Ошибка при создании контакта'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ContactCreatePayload }) =>
      hrApi.updateContact(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', workspaceId] });
      toast.success('Контакт обновлён');
      onSuccess?.(data);
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Ошибка при обновлении контакта'));
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const needsGuarantor = superGroup === 'SYSTEM' && !contact?.user;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (needsGuarantor && !form.guarantor) {
      toast.error('Для системного теневого контакта укажите поручителя');
      return;
    }
    const payload: ContactCreatePayload = {
      workspace: workspaceId,
      super_group: superGroup,
      first_name: form.first_name || undefined,
      last_name: form.last_name || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      group: form.group,
      hr_role: form.hr_role || undefined,
      guarantor: form.guarantor,
      tariff_rate:
        form.tariff_rate === '' || form.tariff_rate == null
          ? null
          : Number(form.tariff_rate),
      currency: form.currency,
    };
    if (isEdit && contact) {
      updateMutation.mutate({ id: contact.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!isOpen) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'profile', label: 'Профиль' },
    { id: 'finance', label: 'Финансы' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-imperial-surface border border-white/10 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">
            {isEdit ? 'Редактировать контакт' : 'Новый контакт'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-imperial-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                  ? 'text-imperial-gold border-b-2 border-imperial-gold'
                  : 'text-imperial-muted hover:text-white'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'profile' && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-imperial-muted mb-1">
                    Имя
                  </label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-imperial-gold/50 focus:border-imperial-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-imperial-muted mb-1">
                    Фамилия
                  </label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-imperial-gold/50 focus:border-imperial-gold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-imperial-muted mb-1">
                  Email {needsGuarantor ? '' : '(необязательно для теневого)'}
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-imperial-gold/50 focus:border-imperial-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-imperial-muted mb-1">
                  Телефон
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-imperial-gold/50 focus:border-imperial-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-imperial-muted mb-1">
                  Группа
                </label>
                <select
                  value={form.group}
                  onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-imperial-gold/50 focus:border-imperial-gold"
                >
                  <option value="staff">Staff</option>
                  <option value="employee">Employee</option>
                  <option value="client">Client</option>
                  <option value="contractor">Contractor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-imperial-muted mb-1">
                  Поручитель {needsGuarantor && !contact?.user ? (
                    <span className="text-amber-400">*</span>
                  ) : null}
                </label>
                <select
                  value={form.guarantor ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      guarantor: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-imperial-gold/50 focus:border-imperial-gold"
                >
                  <option value="">— Не выбран —</option>
                  {guarantorOptions.map((m: { id: number; user?: { id: number; first_name?: string; last_name?: string; username?: string } }) => (
                    <option key={m.id} value={m.user!.id}>
                      {[m.user!.first_name, m.user!.last_name].filter(Boolean).join(' ') ||
                        m.user!.username ||
                        `User ${m.user!.id}`}
                    </option>
                  ))}
                </select>
                {needsGuarantor && !contact?.user && (
                  <p className="text-xs text-amber-400 mt-1">
                    Для теневого контакта в команде поручитель обязателен
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-imperial-muted mb-1">
                  Ставка (тариф)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.tariff_rate === '' ? '' : form.tariff_rate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      tariff_rate: e.target.value === '' ? '' : e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-imperial-gold/50 focus:border-imperial-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-imperial-muted mb-1">
                  Валюта
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-imperial-gold/50 focus:border-imperial-gold"
                >
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-imperial-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
