import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Users, Calendar, Banknote, Building2 } from 'lucide-react';
import { workspaceApi } from '../../api/workspace';
import { hrApi } from '../../api/hr';
import { financeApi } from '../../api/finance';
import type {
  EmployeeProfile,
  Department,
  LeaveRequest,
  PayrollRun,
  PayrollPreviewItem,
  EmployeeCreatePayload,
  LeaveCreatePayload,
} from '../../types/hr';
import { authApi } from '../../api/auth';
import { MemberDetailModal, DepartmentManager, HireEmployeeWizard, PayrollRunDetailModal } from '../../components/hr';

type TabId = 'team' | 'structure' | 'leave' | 'payroll';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-400',
  ONBOARDING: 'bg-amber-500/20 text-amber-400',
  ON_LEAVE: 'bg-blue-500/20 text-blue-400',
  TERMINATED: 'bg-slate-500/20 text-slate-400',
  PENDING: 'bg-amber-500/20 text-amber-400',
  APPROVED: 'bg-emerald-500/20 text-emerald-400',
  REJECTED: 'bg-red-500/20 text-red-400',
  CANCELLED: 'bg-slate-500/20 text-slate-400',
  DRAFT: 'bg-amber-500/20 text-amber-400',
  PAID: 'bg-emerald-500/20 text-emerald-400',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Активен',
  ONBOARDING: 'Онбординг',
  ON_LEAVE: 'В отпуске',
  TERMINATED: 'Уволен',
  PENDING: 'На рассмотрении',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
  CANCELLED: 'Отменено',
  DRAFT: 'Черновик',
  PAID: 'Выплачено',
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  VACATION: 'Отпуск',
  SICK_LEAVE: 'Больничный',
  UNPAID: 'Без содержания',
};

function canSeeManagerActions(groups?: string[], isSuperuser?: boolean): boolean {
  if (isSuperuser) return true;
  if (!groups || !Array.isArray(groups)) return false;
  return groups.includes('Director') || groups.includes('Manager') || groups.includes('Owner');
}

function isDirector(groups?: string[], isSuperuser?: boolean): boolean {
  if (isSuperuser) return true;
  if (!groups || !Array.isArray(groups)) return false;
  return groups.includes('Director') || groups.includes('Owner');
}

export default function HrPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('team');
  const [hireWizardOpen, setHireWizardOpen] = useState(false);
  const [addLeaveOpen, setAddLeaveOpen] = useState(false);
  const [payrollWizardOpen, setPayrollWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardPeriodStart, setWizardPeriodStart] = useState('');
  const [wizardPeriodEnd, setWizardPeriodEnd] = useState('');
  const [wizardPreview, setWizardPreview] = useState<PayrollPreviewItem[] | null>(null);
  const [wizardSourceWalletId, setWizardSourceWalletId] = useState<number | ''>('');
  const [wizardRunId, setWizardRunId] = useState<number | null>(null);
  const [dossierEmployee, setDossierEmployee] = useState<EmployeeProfile | null>(null);
  const [selectedPayrollRunId, setSelectedPayrollRunId] = useState<number | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });
  const canManage = canSeeManagerActions(profile?.groups ?? [], profile?.is_superuser);
  const canEditPayroll = isDirector(profile?.groups ?? [], profile?.is_superuser);

  const { data: workspaceData } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const workspaceId = workspaceData?.id ?? 0;

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['hr-employees', workspaceId],
    queryFn: () => hrApi.getEmployees(workspaceId),
    enabled: workspaceId > 0,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['hr-departments', workspaceId],
    queryFn: () => hrApi.getDepartments(workspaceId),
    enabled: workspaceId > 0,
  });

  const { data: hrContacts = [] } = useQuery({
    queryKey: ['contacts', workspaceId],
    queryFn: () => hrApi.getContacts({ workspace_id: workspaceId }),
    enabled: workspaceId > 0 && hireWizardOpen,
  });

  const { data: leaveRequests = [], isLoading: loadingLeave } = useQuery({
    queryKey: ['hr-leave-requests', workspaceId],
    queryFn: () => hrApi.getLeaveRequests(workspaceId),
    enabled: workspaceId > 0,
  });

  const { data: payrollRuns = [], isLoading: loadingPayroll } = useQuery({
    queryKey: ['hr-payroll-runs', workspaceId],
    queryFn: () => hrApi.getPayrollRuns(workspaceId),
    enabled: workspaceId > 0,
  });

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceMembers(workspaceId),
    enabled: workspaceId > 0,
  });
  const workspaceMembers = Array.isArray(membersData) ? membersData : [];

  const { data: wallets = [] } = useQuery({
    queryKey: ['finance-wallets', workspaceId],
    queryFn: () => financeApi.getWallets({ workspace: workspaceId }),
    enabled: workspaceId > 0,
  });

  const { data: allWallets = [] } = useQuery({
    queryKey: ['finance-wallets-all'],
    queryFn: () => financeApi.getWallets(),
    enabled: hireWizardOpen,
  });
  const companyWallets = wallets.filter((w) => w.workspace === workspaceId);

  const createEmployeeMutation = useMutation({
    mutationFn: (data: EmployeeCreatePayload) => hrApi.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees', workspaceId] });
      setHireWizardOpen(false);
      toast.success('Сотрудник добавлен');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка при добавлении');
    },
  });

  const createLeaveMutation = useMutation({
    mutationFn: (data: LeaveCreatePayload) => hrApi.createLeaveRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-requests', workspaceId] });
      setAddLeaveOpen(false);
      toast.success('Заявка создана');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка при создании заявки');
    },
  });

  const approveLeaveMutation = useMutation({
    mutationFn: (id: number) => hrApi.approveLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-requests', workspaceId] });
      toast.success('Заявка одобрена');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка');
    },
  });

  const rejectLeaveMutation = useMutation({
    mutationFn: (id: number) => hrApi.rejectLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-requests', workspaceId] });
      toast.success('Заявка отклонена');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка');
    },
  });

  const usedMemberIds = new Set(employees.map((e) => e.member));
  const availableMembers = workspaceMembers.filter((m: { id: number }) => !usedMemberIds.has(m.id));

  const handlePayrollWizardStart = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setWizardPeriodStart(start.toISOString().slice(0, 10));
    setWizardPeriodEnd(end.toISOString().slice(0, 10));
    setWizardPreview(null);
    setWizardSourceWalletId('');
    setWizardRunId(null);
    setWizardStep(1);
    setPayrollWizardOpen(true);
  };

  const handlePayrollStep1Next = async () => {
    if (!wizardPeriodStart || !wizardPeriodEnd || !workspaceId) {
      toast.error('Укажите период');
      return;
    }
    try {
      const preview = await hrApi.getPayrollPreview({
        workspace_id: workspaceId,
        period_start: wizardPeriodStart,
        period_end: wizardPeriodEnd,
      });
      setWizardPreview(preview);
      setWizardStep(2);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Ошибка загрузки предпросмотра');
    }
  };

  const handlePayrollStep2Next = async () => {
    if (!workspaceId || !wizardPeriodStart || !wizardPeriodEnd) return;
    try {
      const run = await hrApi.createPayrollRun({
        workspace_id: workspaceId,
        period_start: wizardPeriodStart,
        period_end: wizardPeriodEnd,
      });
      setWizardRunId(run.id);
      setWizardStep(3);
      queryClient.invalidateQueries({ queryKey: ['hr-payroll-runs', workspaceId] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Ошибка создания ведомости');
    }
  };

  const handlePayrollCommit = async () => {
    if (!wizardRunId || wizardSourceWalletId === '') {
      toast.error('Выберите кошелёк компании');
      return;
    }
    try {
      await hrApi.commitPayrollRun(wizardRunId, wizardSourceWalletId as number);
      toast.success('Выплата выполнена! Зарплата начислена.');
      queryClient.invalidateQueries({ queryKey: ['hr-payroll-runs', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      setPayrollWizardOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Ошибка при выплате');
    }
  };

  const totalPreviewAmount = wizardPreview?.reduce((s, p) => s + parseFloat(p.net_amount), 0) ?? 0;
  const deptMap = new Map<number, Department>(departments.map((d) => [d.id, d]));

  if (!workspaceId) {
    return (
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
        Выберите рабочее пространство.
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'team', label: 'Команда', icon: <Users className="w-4 h-4" /> },
    { id: 'structure', label: 'Структура', icon: <Building2 className="w-4 h-4" /> },
    { id: 'leave', label: 'Отпуска', icon: <Calendar className="w-4 h-4" /> },
    { id: 'payroll', label: 'Зарплата', icon: <Banknote className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">HR & Зарплата</h1>

      <div className="flex gap-2 border-b border-white/10 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-imperial-gold text-imperial-bg'
                : 'text-imperial-muted hover:bg-white/10 hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Team */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <button
                type="button"
                onClick={() => setHireWizardOpen(true)}
                className="px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 transition-colors"
              >
                + Добавить сотрудника
              </button>
            )}
          </div>
          {loadingEmployees ? (
            <div className="text-imperial-muted">Загрузка…</div>
          ) : employees.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
              Нет сотрудников. Добавьте профиль сотрудника.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {employees.map((emp) => {
                const dept = emp.department ? deptMap.get(emp.department) : null;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setDossierEmployee(emp)}
                    className="rounded-xl border border-white/10 bg-imperial-surface/60 p-4 flex items-start gap-4 w-full text-left hover:border-imperial-gold/30 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-imperial-gold/20 flex items-center justify-center text-imperial-gold font-bold text-lg shrink-0">
                      {emp.display_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white truncate">{emp.display_name}</p>
                      <p className="text-sm text-imperial-muted truncate">{emp.job_title || '—'}</p>
                      <p className="text-sm text-imperial-muted truncate">{dept?.name ?? '—'}</p>
                      <span
                        className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[emp.status] ?? 'bg-white/10'}`}
                      >
                        {STATUS_LABEL[emp.status] ?? emp.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Structure */}
      {activeTab === 'structure' && (
        <div className="space-y-4">
          <DepartmentManager
            workspaceId={workspaceId}
            employees={employees}
            departments={departments}
          />
        </div>
      )}

      {/* Tab Leave */}
      {activeTab === 'leave' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setAddLeaveOpen(true)}
              className="px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 transition-colors"
            >
              + Подать заявку
            </button>
          </div>
          {loadingLeave ? (
            <div className="text-imperial-muted">Загрузка…</div>
          ) : leaveRequests.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
              Нет заявок на отпуск.
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-imperial-surface/60 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-imperial-muted text-sm">
                    <th className="p-3">Сотрудник</th>
                    <th className="p-3">Тип</th>
                    <th className="p-3">Период</th>
                    <th className="p-3">Статус</th>
                    {canManage && <th className="p-3 text-right">Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((lr: LeaveRequest) => {
                    const emp = employees.find((e) => e.member === lr.member);
                    const memberInfo = workspaceMembers.find((m: { id: number }) => m.id === lr.member);
                    const name =
                      emp?.display_name ??
                      (memberInfo?.user
                        ? [memberInfo.user.first_name, memberInfo.user.last_name].filter(Boolean).join(' ') ||
                          memberInfo.user.username
                        : `#${lr.member}`);
                    return (
                      <tr key={lr.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-3 text-white">{name}</td>
                        <td className="p-3 text-imperial-muted">{LEAVE_TYPE_LABEL[lr.type] ?? lr.type}</td>
                        <td className="p-3 text-imperial-muted">
                          {lr.start_date} — {lr.end_date}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[lr.status] ?? 'bg-white/10'}`}
                          >
                            {STATUS_LABEL[lr.status] ?? lr.status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="p-3 text-right">
                            {lr.status === 'PENDING' && (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => approveLeaveMutation.mutate(lr.id)}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500"
                                >
                                  Одобрить
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectLeaveMutation.mutate(lr.id)}
                                  className="px-3 py-1 rounded-lg bg-red-600/80 text-white text-sm hover:bg-red-500"
                                >
                                  Отклонить
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payroll */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <button
                type="button"
                onClick={handlePayrollWizardStart}
                className="px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 transition-colors"
              >
                Начислить
              </button>
            )}
          </div>
          {loadingPayroll ? (
            <div className="text-imperial-muted">Загрузка…</div>
          ) : payrollRuns.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
              Нет ведомостей. Нажмите «Начислить» для создания.
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-imperial-surface/60 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-imperial-muted text-sm">
                    <th className="p-3">Период</th>
                    <th className="p-3 text-right">Сумма</th>
                    <th className="p-3">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {(payrollRuns as PayrollRun[]).map((run) => (
                    <tr
                      key={run.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPayrollRunId(run.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedPayrollRunId(run.id)}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    >
                      <td className="p-3 text-white">
                        {run.period_start} — {run.period_end}
                      </td>
                      <td className="p-3 text-right font-medium text-imperial-gold">
                        {run.total_amount} {run.currency}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[run.status] ?? 'bg-white/10'}`}
                        >
                          {STATUS_LABEL[run.status] ?? run.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Hire Employee Wizard */}
      {hireWizardOpen && (
        <HireEmployeeWizard
          isOpen={hireWizardOpen}
          onClose={() => setHireWizardOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['hr-employees', workspaceId] });
            queryClient.invalidateQueries({ queryKey: ['contacts', workspaceId] });
            toast.success('Сотрудник добавлен');
          }}
          workspaceId={workspaceId}
          departments={departments}
          contacts={hrContacts}
          availableMembers={availableMembers}
          employees={employees}
          workspaceMembers={workspaceMembers}
          wallets={allWallets}
        />
      )}

      {/* Add Leave Modal */}
      {addLeaveOpen && (
        <AddLeaveModal
          members={workspaceMembers}
          employees={employees}
          onClose={() => setAddLeaveOpen(false)}
          onSubmit={(data) => createLeaveMutation.mutate(data)}
          isSubmitting={createLeaveMutation.isPending}
        />
      )}

      {/* Payroll Wizard Modal */}
      {payrollWizardOpen && (
        <PayrollWizardModal
          step={wizardStep}
          periodStart={wizardPeriodStart}
          periodEnd={wizardPeriodEnd}
          onPeriodChange={{ start: setWizardPeriodStart, end: setWizardPeriodEnd }}
          preview={wizardPreview}
          totalAmount={totalPreviewAmount}
          sourceWalletId={wizardSourceWalletId}
          onSourceWalletChange={setWizardSourceWalletId}
          companyWallets={companyWallets}
          onClose={() => setPayrollWizardOpen(false)}
          onStep1Next={handlePayrollStep1Next}
          onStep2Next={handlePayrollStep2Next}
          onCommit={handlePayrollCommit}
        />
      )}

      {/* Модалка ведомости по клику */}
      {selectedPayrollRunId && (
        <PayrollRunDetailModal
          runId={selectedPayrollRunId}
          onClose={() => setSelectedPayrollRunId(null)}
          workspaceId={workspaceId}
          canEdit={canEditPayroll}
        />
      )}

      {/* Личное дело (унифицированная карточка) */}
      {dossierEmployee && (
        <MemberDetailModal
          isOpen={!!dossierEmployee}
          onClose={() => setDossierEmployee(null)}
          workspaceId={workspaceId}
          employee={employees.find((e) => e.id === dossierEmployee.id) ?? dossierEmployee}
          departments={departments}
        />
      )}
    </div>
  );
}

interface AddEmployeeModalProps {
  departments: Department[];
  availableMembers: { id: number; user?: { first_name?: string; last_name?: string; username?: string } }[];
  wallets: { id: number; name: string; workspace: number | null; owner: number | null }[];
  workspaceId: number;
  onClose: () => void;
  onSubmit: (data: EmployeeCreatePayload) => void;
  isSubmitting: boolean;
}

function AddEmployeeModal({
  departments,
  availableMembers,
  wallets,
  workspaceId,
  onClose,
  onSubmit,
  isSubmitting,
}: AddEmployeeModalProps) {
  const [memberId, setMemberId] = useState<number | ''>('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [jobTitle, setJobTitle] = useState('');
  const [salaryMode, setSalaryMode] = useState<'FIXED' | 'HOURLY'>('FIXED');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [paymentWalletId, setPaymentWalletId] = useState<number | ''>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (memberId === '') {
      return;
    }
    onSubmit({
      member: memberId as number,
      department: departmentId === '' ? null : (departmentId as number),
      job_title: jobTitle || undefined,
      status: 'ACTIVE',
      employment_type: 'FULL_TIME',
      fte: 1,
      salary_mode: salaryMode,
      salary_amount: salaryAmount ? parseFloat(salaryAmount) : null,
      currency: 'RUB',
      payment_wallet: paymentWalletId === '' ? null : (paymentWalletId as number),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl border border-white/10 bg-imperial-surface p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-4">Добавить сотрудника</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-imperial-muted mb-1">Участник workspace *</label>
            <select
              value={memberId === '' ? '' : memberId}
              onChange={(e) => setMemberId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              required
            >
              <option value="">Выберите…</option>
              {availableMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {[m.user?.first_name, m.user?.last_name].filter(Boolean).join(' ') || m.user?.username || `#${m.id}`}
                </option>
              ))}
            </select>
          </div>
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
              placeholder="CEO / Генеральный директор"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
          </div>
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
              {salaryMode === 'FIXED' ? 'Оклад (₽/мес)' : 'Ставка (₽/час)'} *
            </label>
            <input
              type="number"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              placeholder="1000000"
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
              <option value="">Выберите кошелёк для выплаты сотруднику…</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 text-imperial-muted hover:bg-white/15">
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || memberId === ''}
              className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Сохранение…' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddLeaveModalProps {
  members: { id: number; user?: { first_name?: string; last_name?: string; username?: string } }[];
  employees: EmployeeProfile[];
  onClose: () => void;
  onSubmit: (data: LeaveCreatePayload) => void;
  isSubmitting: boolean;
}

function AddLeaveModal({ members, employees, onClose, onSubmit, isSubmitting }: AddLeaveModalProps) {
  const [memberId, setMemberId] = useState<number | ''>('');
  const [type, setType] = useState<'VACATION' | 'SICK_LEAVE' | 'UNPAID'>('VACATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (memberId === '' || !startDate || !endDate) return;
    onSubmit({ member: memberId as number, type, start_date: startDate, end_date: endDate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl border border-white/10 bg-imperial-surface p-6 max-w-lg w-full shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4">Заявка на отпуск</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-imperial-muted mb-1">Сотрудник *</label>
            <select
              value={memberId === '' ? '' : memberId}
              onChange={(e) => setMemberId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              required
            >
              <option value="">Выберите…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {[m.user?.first_name, m.user?.last_name].filter(Boolean).join(' ') || m.user?.username || `#${m.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-imperial-muted mb-1">Тип *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'VACATION' | 'SICK_LEAVE' | 'UNPAID')}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="VACATION">Отпуск</option>
              <option value="SICK_LEAVE">Больничный</option>
              <option value="UNPAID">Без содержания</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-imperial-muted mb-1">Дата начала *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-imperial-muted mb-1">Дата окончания *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 text-imperial-muted hover:bg-white/15">
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Сохранение…' : 'Подать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PayrollWizardModalProps {
  step: number;
  periodStart: string;
  periodEnd: string;
  onPeriodChange: { start: (v: string) => void; end: (v: string) => void };
  preview: PayrollPreviewItem[] | null;
  totalAmount: number;
  sourceWalletId: number | '';
  onSourceWalletChange: (v: number | '') => void;
  companyWallets: { id: number; name: string }[];
  onClose: () => void;
  onStep1Next: () => void;
  onStep2Next: () => void;
  onCommit: () => void;
}

function PayrollWizardModal({
  step,
  periodStart,
  periodEnd,
  onPeriodChange,
  preview,
  totalAmount,
  sourceWalletId,
  onSourceWalletChange,
  companyWallets,
  onClose,
  onStep1Next,
  onStep2Next,
  onCommit,
}: PayrollWizardModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl border border-white/10 bg-imperial-surface p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-4">
          Начисление зарплаты — Шаг {step} из 3
        </h3>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-imperial-muted mb-1">Дата начала</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => onPeriodChange.start(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm text-imperial-muted mb-1">Дата окончания</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => onPeriodChange.end(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 text-imperial-muted">
                Отмена
              </button>
              <button
                type="button"
                onClick={onStep1Next}
                className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium"
              >
                Далее: предпросмотр
              </button>
            </div>
          </div>
        )}

        {step === 2 && preview && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-imperial-muted">
                    <th className="p-2 text-left">Сотрудник</th>
                    <th className="p-2 text-right">Дней</th>
                    <th className="p-2 text-right">Часов</th>
                    <th className="p-2 text-right">Начислено</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.employee_id} className="border-t border-white/5">
                      <td className="p-2 text-white">
                        {p.display_name}
                        {!p.has_wallet && (
                          <span className="ml-2 text-amber-400 text-xs">(нет кошелька)</span>
                        )}
                      </td>
                      <td className="p-2 text-right text-imperial-muted">
                        {p.days_worked != null ? p.days_worked : '—'}
                      </td>
                      <td className="p-2 text-right text-imperial-muted">
                        {p.hours_worked != null ? p.hours_worked.toFixed(1) : '—'}
                      </td>
                      <td className="p-2 text-right font-medium text-imperial-gold">
                        {p.net_amount} ₽
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-lg font-bold text-imperial-gold">
              Итого к выплате: {totalAmount.toFixed(2)} ₽
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => {}} className="invisible" aria-hidden="true" />
              <button
                type="button"
                onClick={onStep2Next}
                className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium"
              >
                Создать ведомость и перейти к оплате
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-imperial-muted mb-1">Кошелёк компании (источник) *</label>
              <select
                value={sourceWalletId === '' ? '' : sourceWalletId}
                onChange={(e) => onSourceWalletChange(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                <option value="">Выберите кошелёк…</option>
                {companyWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-imperial-muted text-sm">
              Сумма {totalAmount.toFixed(2)} ₽ будет списана с выбранного кошелька и зачислена на кошельки сотрудников.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 text-imperial-muted">
                Отмена
              </button>
              <button
                type="button"
                onClick={onCommit}
                disabled={sourceWalletId === ''}
                className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium disabled:opacity-50"
              >
                Оплатить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
