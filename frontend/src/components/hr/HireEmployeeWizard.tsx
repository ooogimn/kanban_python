/**
 * Пошаговый визард найма сотрудника.
 * Шаг 1: Выбрать участника или пригласить нового
 * Шаг 2: Отдел, должность, тип занятости
 * Шаг 3: Оклад/ставка, кошелёк для выплат
 * Шаг 4: Загрузить договор/оферту (опционально)
 */
import { useState } from 'react';
import { ChevronRight, UserPlus, Briefcase, Banknote, FileText } from 'lucide-react';
import type {
  Contact,
  Department,
  EmployeeCreatePayload,
  EmployeeProfile,
} from '../../types/hr';
import type { ContactCreatePayload } from '../../types/hr';
import { hrApi } from '../../api/hr';

export interface HireEmployeeWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceId: number;
  departments: Department[];
  /** Контакты (персонал) — для выбора из списка контактов */
  contacts: Contact[];
  /** Участники workspace без EmployeeProfile — директор и др., кто ещё не в контактах */
  availableMembers: { id: number; user?: { first_name?: string; last_name?: string; username?: string; email?: string } }[];
  employees: EmployeeProfile[];
  workspaceMembers: { id: number; user?: { id?: number } }[];
  wallets: { id: number; name: string; workspace: number | null }[];
}

const STEP_LABELS = [
  { icon: UserPlus, label: 'Кандидат' },
  { icon: Briefcase, label: 'Отдел и должность' },
  { icon: Banknote, label: 'Оклад' },
  { icon: FileText, label: 'Документы' },
];

function getDisplayName(c: Contact): string {
  const name = [c.last_name, c.first_name].filter(Boolean).join(' ').trim();
  return name || c.email || `Контакт #${c.id}`;
}

export default function HireEmployeeWizard({
  isOpen,
  onClose,
  onSuccess,
  workspaceId,
  departments,
  contacts,
  availableMembers,
  employees,
  workspaceMembers,
  wallets,
}: HireEmployeeWizardProps) {
  const usedMemberIds = new Set(employees.map((e) => e.member));
  const contactsCanHire = contacts
    .filter((c) => c.super_group === 'SYSTEM' && c.user != null)
    .map((c) => {
      const member = workspaceMembers.find((m) => m.user?.id === c.user);
      return member && !usedMemberIds.has(member.id) ? { contact: c, memberId: member.id } : null;
    })
    .filter((x): x is { contact: Contact; memberId: number } => x != null);
  const membersWithoutContact = availableMembers.filter(
    (m) => !contacts.some((c) => c.user === m.user?.id)
  );
  const candidatesForHire = [
    ...contactsCanHire.map((x) => ({
      memberId: x.memberId,
      label: getDisplayName(x.contact),
      source: 'contact' as const,
    })),
    ...membersWithoutContact.map((m) => ({
      memberId: m.id,
      label:
        [m.user?.first_name, m.user?.last_name].filter(Boolean).join(' ') ||
        m.user?.username ||
        m.user?.email ||
        `#${m.id}`,
      source: 'member' as const,
    })),
  ];

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'from_contacts' | 'invite'>('from_contacts');
  const [memberId, setMemberId] = useState<number | ''>('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteDone, setInviteDone] = useState(false);
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [jobTitle, setJobTitle] = useState('');
  const [employmentType, setEmploymentType] = useState<'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR'>('FULL_TIME');
  const [salaryMode, setSalaryMode] = useState<'FIXED' | 'HOURLY'>('FIXED');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [paymentWalletId, setPaymentWalletId] = useState<number | ''>('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<'OFFER' | 'CONTRACT' | 'NDA' | 'OTHER'>('OFFER');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceedStep1 = mode === 'from_contacts' ? memberId !== '' : inviteEmail.trim().length > 0;
  const canProceedStep2 = departmentId !== '' || jobTitle.trim().length > 0;
  const canProceedStep3 = salaryAmount && parseFloat(salaryAmount) > 0 && paymentWalletId !== '';

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteSubmitting(true);
    setError(null);
    try {
      const payload: ContactCreatePayload = {
        workspace: workspaceId,
        super_group: 'SYSTEM',
        first_name: inviteFirstName.trim() || undefined,
        last_name: inviteLastName.trim() || undefined,
        email: inviteEmail.trim(),
      };
      const contact = await hrApi.createContact(payload);
      await hrApi.inviteContact(contact.id);
      setInviteDone(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : 'Ошибка при создании приглашения');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (memberId === '' || !paymentWalletId) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: EmployeeCreatePayload = {
        member: memberId as number,
        department: departmentId === '' ? null : (departmentId as number),
        job_title: jobTitle || undefined,
        status: 'ACTIVE',
        employment_type: employmentType,
        fte: 1,
        salary_mode: salaryMode,
        salary_amount: salaryAmount ? parseFloat(salaryAmount) : null,
        currency: 'RUB',
        payment_wallet: paymentWalletId as number,
      };
      const employee = await hrApi.createEmployee(payload);
      if (docFile && employee) {
        const formData = new FormData();
        formData.append('file', docFile);
        formData.append('doc_type', docType);
        formData.append('name', docFile.name);
        await hrApi.uploadEmployeeDocument(employee.id, formData);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : 'Ошибка при добавлении сотрудника');
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setMode('existing');
    setMemberId('');
    setInviteEmail('');
    setInviteFirstName('');
    setInviteLastName('');
    setInviteDone(false);
    setDepartmentId('');
    setJobTitle('');
    setEmploymentType('FULL_TIME');
    setSalaryMode('FIXED');
    setSalaryAmount('');
    setPaymentWalletId('');
    setDocFile(null);
    setDocType('OFFER');
    setError(null);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-imperial-surface shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-white/10 shrink-0">
          <h2 className="text-xl font-bold text-white">Нанять сотрудника</h2>
          <div className="flex gap-2 mt-3">
            {STEP_LABELS.map((s, i) => (
              <div
                key={s.label}
                className={`flex items-center gap-1 text-sm ${i + 1 <= step ? 'text-imperial-gold' : 'text-imperial-muted'}`}
              >
                <s.icon className="w-4 h-4" />
                <span>{s.label}</span>
                {i < STEP_LABELS.length - 1 && <ChevronRight className="w-4 h-4" />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/20 text-red-400 p-3 text-sm">{error}</div>
          )}

          {step === 1 && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('from_contacts')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    mode === 'from_contacts'
                      ? 'bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40'
                      : 'bg-white/5 text-imperial-muted hover:text-white'
                  }`}
                >
                  Выбрать из контактов
                </button>
                <button
                  type="button"
                  onClick={() => setMode('invite')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    mode === 'invite'
                      ? 'bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40'
                      : 'bg-white/5 text-imperial-muted hover:text-white'
                  }`}
                >
                  Добавить нового
                </button>
              </div>

              {mode === 'from_contacts' ? (
                <div>
                  <label className="block text-sm text-imperial-muted mb-2">
                    Выберите контакт из списка (персонал, ещё не в отделе кадров) *
                  </label>
                  <select
                    value={memberId === '' ? '' : memberId}
                    onChange={(e) => setMemberId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  >
                    <option value="">Выберите из контактов…</option>
                    {candidatesForHire.map((c) => (
                      <option key={c.memberId} value={c.memberId}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {candidatesForHire.length === 0 && (
                    <p className="text-imperial-muted text-sm mt-1">
                      Нет подходящих контактов. Добавьте персонал в Контакты или создайте нового.
                    </p>
                  )}
                </div>
              ) : inviteDone ? (
                <div className="rounded-lg bg-emerald-500/20 text-emerald-400 p-4">
                  Приглашение отправлено на {inviteEmail}. После принятия сотрудник появится в списке участников.
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-imperial-muted mb-1">Email *</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                      placeholder="ivan@company.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-imperial-muted mb-1">Имя</label>
                      <input
                        type="text"
                        value={inviteFirstName}
                        onChange={(e) => setInviteFirstName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-imperial-muted mb-1">Фамилия</label>
                      <input
                        type="text"
                        value={inviteLastName}
                        onChange={(e) => setInviteLastName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={inviteSubmitting || !inviteEmail.trim()}
                    className="w-full py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium disabled:opacity-50"
                  >
                    {inviteSubmitting ? 'Отправка…' : 'Отправить приглашение'}
                  </button>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-imperial-muted mb-1">Отдел</label>
                <select
                  value={departmentId === '' ? '' : departmentId}
                  onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-imperial-muted mb-1">Должность</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="CEO / Разработчик"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm text-imperial-muted mb-1">Тип занятости</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as typeof employmentType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="FULL_TIME">Полная</option>
                  <option value="PART_TIME">Частичная</option>
                  <option value="CONTRACTOR">Подрядчик</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-imperial-muted mb-1">Тип зарплаты</label>
                <select
                  value={salaryMode}
                  onChange={(e) => setSalaryMode(e.target.value as 'FIXED' | 'HOURLY')}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="FIXED">Фиксированная (месяц)</option>
                  <option value="HOURLY">Почасовая</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-imperial-muted mb-1">
                  {salaryMode === 'FIXED' ? 'Оклад (₽/мес) *' : 'Ставка (₽/час) *'}
                </label>
                <input
                  type="number"
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  placeholder="100000"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm text-imperial-muted mb-1">Кошелёк для выплаты *</label>
                <select
                  value={paymentWalletId === '' ? '' : paymentWalletId}
                  onChange={(e) => setPaymentWalletId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="">Выберите…</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-imperial-muted text-sm">
                Загрузите договор или оферту (опционально). Можно будет добавить позже в карточке сотрудника.
              </p>
              <div>
                <label className="block text-sm text-imperial-muted mb-1">Тип документа</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as typeof docType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="OFFER">Оферта</option>
                  <option value="CONTRACT">Договор</option>
                  <option value="NDA">NDA</option>
                  <option value="OTHER">Другое</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-imperial-muted mb-1">Файл (PDF)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-imperial-gold/20 file:text-imperial-gold"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 flex justify-between shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-white/10 text-imperial-muted hover:text-white"
          >
            Отмена
          </button>
          <div className="flex gap-2">
            {step > 1 && mode === 'from_contacts' && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white"
              >
                Назад
              </button>
            )}
            {step < 4 ? (
              mode !== 'invite' && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 1 && !canProceedStep1) ||
                    (step === 2 && !canProceedStep2) ||
                    (step === 3 && !canProceedStep3)
                  }
                  className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium disabled:opacity-50"
                >
                  Далее
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !canProceedStep3}
                className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium disabled:opacity-50"
              >
                {submitting ? 'Сохранение…' : 'Нанять'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
