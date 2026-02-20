/**
 * Унифицированная учётная карточка (Личное дело).
 * Открывается из /contacts и /hr. Показывает HR-вкладки только при наличии EmployeeProfile и правах.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { X, User, Briefcase, Banknote, Calendar, FileText, ExternalLink, Clock, Pencil, Plus } from 'lucide-react';
import { workspaceApi } from '../../api/workspace';
import { hrApi, type ContactTimelogItem } from '../../api/hr';
import type {
  EmployeeProfile,
  Department,
  LeaveRequest,
  LeaveCreatePayload,
  PayrollItem,
  Contact,
  ContactDetail,
  EmployeeDocument,
  EmployeeUpdatePayload,
} from '../../types/hr';
import { authApi } from '../../api/auth';

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

function canSeeHR(groups?: string[], isSuperuser?: boolean): boolean {
  if (isSuperuser) return true;
  if (!groups || !Array.isArray(groups)) return false;
  return groups.includes('Director') || groups.includes('Manager') || groups.includes('Owner');
}

export interface MemberDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
  /** Открытие из HR — передаём сотрудника */
  employee?: EmployeeProfile | null;
  /** Открытие из Contacts — передаём контакт, ищем EmployeeProfile по user */
  contact?: Contact | ContactDetail | null;
  departments?: Department[];
  /** Вкладка при открытии (например payroll) */
  initialTab?: TabId;
}

type TabId = 'profile' | 'hr' | 'payroll' | 'timeoff' | 'timesheet' | 'documents';

const DOC_TYPE_LABEL: Record<string, string> = {
  OFFER: 'Оферта',
  CONTRACT: 'Договор',
  NDA: 'NDA',
  PASSPORT: 'Паспорт',
  OTHER: 'Другое',
};

function AddLeaveForm({
  memberId,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  memberId: number;
  onSubmit: (p: LeaveCreatePayload) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [type, setType] = useState<'VACATION' | 'SICK_LEAVE' | 'UNPAID'>('VACATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    onSubmit({ member: memberId, type, start_date: startDate, end_date: endDate });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 p-4 space-y-3">
      <p className="text-sm text-imperial-muted">Новая заявка на отпуск</p>
      <div className="flex flex-wrap gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'VACATION' | 'SICK_LEAVE' | 'UNPAID')}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
        >
          <option value="VACATION">Отпуск</option>
          <option value="SICK_LEAVE">Больничный</option>
          <option value="UNPAID">Без содержания</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          required
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          required
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-white/10 text-imperial-muted text-sm hover:bg-white/15"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-3 py-2 rounded-lg bg-imperial-gold text-imperial-bg text-sm font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </div>
    </form>
  );
}

function HrEditTab({
  employee,
  departments,
  department,
  editMode,
  onEdit,
  onCancel,
  onSubmit,
  isSubmitting,
}: {
  employee: EmployeeProfile;
  departments: Department[];
  department: Department | undefined;
  editMode: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (p: EmployeeUpdatePayload) => void;
  isSubmitting: boolean;
}) {
  const [jobTitle, setJobTitle] = useState(employee.job_title || '');
  const [departmentId, setDepartmentId] = useState<number | ''>(employee.department ?? '');
  const [salaryMode, setSalaryMode] = useState<'FIXED' | 'HOURLY'>(employee.salary_mode);
  const [salaryAmount, setSalaryAmount] = useState(employee.salary_amount ?? '');

  useEffect(() => {
    setJobTitle(employee.job_title || '');
    setDepartmentId(employee.department ?? '');
    setSalaryMode(employee.salary_mode);
    setSalaryAmount(employee.salary_amount ?? '');
  }, [employee.id, employee.job_title, employee.department, employee.salary_mode, employee.salary_amount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      job_title: jobTitle || undefined,
      department: departmentId === '' ? null : (departmentId as number),
      salary_mode: salaryMode,
      salary_amount: salaryAmount ? parseFloat(salaryAmount) : null,
    });
  };

  if (editMode) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-imperial-muted text-xs uppercase tracking-wider mb-1">Должность</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-imperial-muted text-xs uppercase tracking-wider mb-1">Отдел</label>
          <select
            value={departmentId === '' ? '' : departmentId}
            onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
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
          <label className="block text-imperial-muted text-xs uppercase tracking-wider mb-1">Тип ставки</label>
          <select
            value={salaryMode}
            onChange={(e) => setSalaryMode(e.target.value as 'FIXED' | 'HOURLY')}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
          >
            <option value="FIXED">Фиксированная (мес)</option>
            <option value="HOURLY">Почасовая</option>
          </select>
        </div>
        <div>
          <label className="block text-imperial-muted text-xs uppercase tracking-wider mb-1">
            Ставка ({employee.currency}) {salaryMode === 'HOURLY' ? '/ час' : '/ мес'}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={salaryAmount}
            onChange={(e) => setSalaryAmount(e.target.value)}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/10 text-imperial-muted hover:bg-white/15"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-imperial-gold hover:bg-imperial-gold/20 text-sm"
        >
          <Pencil className="w-4 h-4" />
          Редактировать
        </button>
      </div>
      <div>
        <p className="text-imperial-muted text-xs uppercase tracking-wider mb-1">Должность</p>
        <p className="text-white">{employee.job_title || '—'}</p>
      </div>
      <div>
        <p className="text-imperial-muted text-xs uppercase tracking-wider mb-1">Отдел</p>
        <p className="text-white">{department?.name ?? '—'}</p>
      </div>
      <div>
        <p className="text-imperial-muted text-xs uppercase tracking-wider mb-1">Оклад / Ставка</p>
        <p className="text-imperial-gold font-medium">
          {employee.salary_amount
            ? `${employee.salary_amount} ${employee.currency} ${employee.salary_mode === 'HOURLY' ? '/ час' : '/ мес'}`
            : '—'}
        </p>
      </div>
      <div>
        <p className="text-imperial-muted text-xs uppercase tracking-wider mb-1">Дата найма</p>
        <p className="text-white">{employee.date_hired ?? '—'}</p>
      </div>
      <div>
        <p className="text-imperial-muted text-xs uppercase tracking-wider mb-1">Тип занятости</p>
        <p className="text-white">
          {employee.employment_type === 'FULL_TIME' ? 'Полная' : employee.employment_type === 'PART_TIME' ? 'Частичная' : 'Подрядчик'}
        </p>
      </div>
    </div>
  );
}

function DocumentsTab({
  employeeId,
  documents,
  onUpload,
  onDelete,
  isUploading,
}: {
  employeeId: number;
  documents: EmployeeDocument[];
  onUpload: (formData: FormData) => void;
  onDelete: (id: number) => void;
  isUploading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<'OFFER' | 'CONTRACT' | 'NDA' | 'OTHER'>('OFFER');

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);
    formData.append('name', file.name);
    onUpload(formData);
    setFile(null);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleUpload} className="rounded-lg border border-white/10 p-4 space-y-3">
        <p className="text-sm text-imperial-muted">Загрузить договор, оферту или другой документ</p>
        <div className="flex flex-wrap gap-3 items-end">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as typeof docType)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 text-sm"
          >
            <option value="OFFER">Оферта</option>
            <option value="CONTRACT">Договор</option>
            <option value="NDA">NDA</option>
            <option value="OTHER">Другое</option>
          </select>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-200 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-imperial-gold/20 file:text-imperial-gold"
          />
          <button
            type="submit"
            disabled={!file || isUploading}
            className="px-3 py-2 rounded-lg bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40 text-sm font-medium disabled:opacity-50"
          >
            {isUploading ? 'Загрузка…' : 'Загрузить'}
          </button>
        </div>
      </form>
      {documents.length === 0 ? (
        <p className="text-imperial-muted">Нет загруженных документов</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-white/10 p-3"
            >
              <div className="min-w-0">
                <p className="text-white font-medium truncate">
                  {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type} — {doc.name || doc.file}
                </p>
                <p className="text-imperial-muted text-xs">
                  {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded text-sm text-imperial-gold hover:bg-imperial-gold/20"
                >
                  Скачать
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(doc.id)}
                  className="px-2 py-1 rounded text-sm text-red-400 hover:bg-red-500/20"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MemberDetailModal({
  isOpen,
  onClose,
  workspaceId,
  employee: employeeProp,
  contact: contactProp,
  departments = [],
  initialTab,
}: MemberDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'profile');
  const [hrEditMode, setHrEditMode] = useState(false);
  const [addLeaveOpen, setAddLeaveOpen] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
    enabled: isOpen,
  });
  const canSeeHRTabs = canSeeHR(profile?.groups ?? [], profile?.is_superuser);

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees', workspaceId],
    queryFn: () => hrApi.getEmployees(workspaceId),
    enabled: isOpen && workspaceId > 0 && !employeeProp,
  });

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceMembers(workspaceId),
    enabled: isOpen && workspaceId > 0,
  });
  const workspaceMembers = Array.isArray(membersData) ? membersData : [];

  const { data: contactDetail } = useQuery({
    queryKey: ['contact-detail', contactProp?.id, workspaceId],
    queryFn: () => hrApi.getContactDetails(contactProp!.id, workspaceId),
    enabled:
      isOpen &&
      !!contactProp?.id &&
      workspaceId > 0 &&
      !employeeProp &&
      (contactProp as Contact).id > 0,
  });

  const contact = contactDetail ?? contactProp;
  const employee: EmployeeProfile | null = employeeProp ?? (() => {
    if (!contact?.user || !workspaceId) return null;
    const member = workspaceMembers.find((m: { user?: { id?: number } }) => m.user?.id === contact.user);
    if (!member) return null;
    return employees.find((e: EmployeeProfile) => e.member === member.id) ?? null;
  })();

  const memberId = employee?.member ?? null;

  const { data: payrollRuns = [] } = useQuery({
    queryKey: ['hr-payroll-runs', workspaceId],
    queryFn: () => hrApi.getPayrollRuns(workspaceId),
    enabled: isOpen && !!employee?.id && workspaceId > 0,
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['hr-leave-requests', workspaceId],
    queryFn: () => hrApi.getLeaveRequests(workspaceId),
    enabled: isOpen && !!memberId && workspaceId > 0,
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery({
    queryKey: ['hr-employee-documents', employee?.id],
    queryFn: () => hrApi.getEmployeeDocuments(employee!.id),
    enabled: isOpen && !!employee?.id,
  });

  const { data: timelogs = [] } = useQuery({
    queryKey: ['hr-employee-timelogs', employee?.id],
    queryFn: () => hrApi.getEmployeeTimelogs(employee!.id),
    enabled: isOpen && !!employee?.id && activeTab === 'timesheet',
  });

  const queryClient = useQueryClient();
  const uploadDocMutation = useMutation({
    mutationFn: ({ empId, formData }: { empId: number; formData: FormData }) =>
      hrApi.uploadEmployeeDocument(empId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee-documents', employee?.id] });
    },
  });
  const deleteDocMutation = useMutation({
    mutationFn: (id: number) => hrApi.deleteEmployeeDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee-documents', employee?.id] });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: (payload: EmployeeUpdatePayload) => hrApi.updateEmployee(employee!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees', workspaceId] });
      setHrEditMode(false);
      toast.success('Данные обновлены');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка сохранения');
    },
  });

  const createLeaveMutation = useMutation({
    mutationFn: (payload: LeaveCreatePayload) => hrApi.createLeaveRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-requests', workspaceId] });
      setAddLeaveOpen(false);
      toast.success('Заявка на отпуск создана');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка создания');
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

  const payrollItems: PayrollItem[] = employee
    ? (payrollRuns as { items?: PayrollItem[] }[]).flatMap((r) => r.items ?? []).filter((i) => i.employee === employee.id)
    : [];

  const memberLeaveRequests = (leaveRequests as LeaveRequest[]).filter((lr) => lr.member === memberId);

  const displayName = employee?.display_name ?? (contact
    ? [contact.last_name, contact.first_name].filter(Boolean).join(' ').trim() || (contact as Contact).email || `#${(contact as Contact).id}`
    : '—');

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const department = employee?.department ? deptMap.get(employee.department) : null;

  const showHRTabs = !!employee && canSeeHRTabs;
  const tabs: { id: TabId; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: 'profile', label: 'Профиль', icon: <User className="w-4 h-4" />, show: true },
    { id: 'hr', label: 'Кадровые данные', icon: <Briefcase className="w-4 h-4" />, show: showHRTabs },
    { id: 'payroll', label: 'Зарплата', icon: <Banknote className="w-4 h-4" />, show: showHRTabs },
    { id: 'timeoff', label: 'Отпуска', icon: <Calendar className="w-4 h-4" />, show: showHRTabs },
    { id: 'timesheet', label: 'Табель', icon: <Clock className="w-4 h-4" />, show: showHRTabs },
    { id: 'documents', label: 'Документы', icon: <FileText className="w-4 h-4" />, show: showHRTabs },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-imperial-surface shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            {contact?.avatar_url ? (
              <img src={contact.avatar_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-imperial-gold/20 border border-imperial-gold/30 flex items-center justify-center text-imperial-gold text-2xl font-bold">
                {displayName[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{displayName}</h2>
              <p className="text-imperial-muted text-sm mt-0.5">
                {employee?.job_title || (contact as Contact)?.hr_role || (contact as Contact)?.group || '—'}
              </p>
              {employee && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                  {STATUS_LABEL[employee.status] ?? employee.status}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {contactProp && (contactProp as Contact).id > 0 && (
              <Link
                to={`/hr/contacts/${(contactProp as Contact).id}${activeTab !== 'profile' ? `?tab=${activeTab}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-imperial-muted hover:text-imperial-gold hover:bg-white/10 text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                В новой вкладке
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-imperial-muted hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 overflow-x-auto shrink-0">
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'text-imperial-gold border-b-2 border-imperial-gold bg-imperial-gold/10'
                  : 'text-imperial-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <p className="text-imperial-muted text-xs uppercase tracking-wider mb-1">Email</p>
                <p className="text-white">{(contact as Contact)?.email || '—'}</p>
              </div>
              {employee && (
                <>
                  <div>
                    <p className="text-imperial-muted text-xs uppercase tracking-wider mb-1">Отдел</p>
                    <p className="text-white">{department?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-imperial-muted text-xs uppercase tracking-wider mb-1">Дата найма</p>
                    <p className="text-white">{employee.date_hired ?? '—'}</p>
                  </div>
                </>
              )}
              {(contact as ContactDetail)?.projects && (contact as ContactDetail).projects.length > 0 && (
                <div>
                  <p className="text-imperial-muted text-xs uppercase tracking-wider mb-2">Проекты</p>
                  <div className="flex flex-wrap gap-2">
                    {(contact as ContactDetail).projects.map((p) => (
                      <span key={p} className="px-3 py-1 rounded-lg bg-white/10 text-white text-sm">{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'hr' && employee && (
            <HrEditTab
              employee={employee}
              departments={departments}
              department={department}
              editMode={hrEditMode}
              onEdit={() => setHrEditMode(true)}
              onCancel={() => setHrEditMode(false)}
              onSubmit={(payload) => updateEmployeeMutation.mutate(payload)}
              isSubmitting={updateEmployeeMutation.isPending}
            />
          )}

          {activeTab === 'payroll' && employee && (
            <div>
              {payrollItems.length === 0 ? (
                <p className="text-imperial-muted">Пока нет начислений</p>
              ) : (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 text-imperial-muted">
                        <th className="p-2 text-left">Период</th>
                        <th className="p-2 text-right">Начислено</th>
                        <th className="p-2">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollItems.map((item) => {
                        const run = (payrollRuns as { period_start: string; period_end: string; items?: PayrollItem[] }[]).find(
                          (r) => r.items?.some((i) => i.id === item.id)
                        );
                        return (
                          <tr key={item.id} className="border-t border-white/5">
                            <td className="p-2 text-white">
                              {run ? `${run.period_start} — ${run.period_end}` : '—'}
                            </td>
                            <td className="p-2 text-right font-medium text-imperial-gold">{item.net_amount} ₽</td>
                            <td className="p-2">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs ${
                                  item.is_paid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                }`}
                              >
                                {item.is_paid ? 'Выплачено' : 'Черновик'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeoff' && employee && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setAddLeaveOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40 hover:bg-imperial-gold/30 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Добавить отпуск
                </button>
              </div>
              {addLeaveOpen && (
                <AddLeaveForm
                  memberId={employee.member}
                  onSubmit={(data) => createLeaveMutation.mutate(data)}
                  onCancel={() => setAddLeaveOpen(false)}
                  isSubmitting={createLeaveMutation.isPending}
                />
              )}
              {memberLeaveRequests.length === 0 && !addLeaveOpen ? (
                <p className="text-imperial-muted">Нет заявок на отпуск</p>
              ) : (
                <div className="space-y-3">
                  {memberLeaveRequests.map((lr) => (
                    <div
                      key={lr.id}
                      className="rounded-lg border border-white/10 p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-white font-medium">{LEAVE_TYPE_LABEL[lr.type] ?? lr.type}</p>
                        <p className="text-imperial-muted text-sm">
                          {lr.start_date} — {lr.end_date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {lr.status === 'PENDING' && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => approveLeaveMutation.mutate(lr.id)}
                              disabled={approveLeaveMutation.isPending}
                              className="px-2 py-1 rounded bg-emerald-600/80 text-white text-xs hover:bg-emerald-500 disabled:opacity-50"
                            >
                              Одобрить
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectLeaveMutation.mutate(lr.id)}
                              disabled={rejectLeaveMutation.isPending}
                              className="px-2 py-1 rounded bg-red-600/80 text-white text-xs hover:bg-red-500 disabled:opacity-50"
                            >
                              Отклонить
                            </button>
                          </div>
                        )}
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            lr.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : lr.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {STATUS_LABEL[lr.status] ?? lr.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'timesheet' && employee && (
            <div>
              {(timelogs as ContactTimelogItem[]).length === 0 ? (
                <p className="text-imperial-muted">Нет записей учёта времени</p>
              ) : (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 text-imperial-muted">
                        <th className="p-2 text-left">Дата</th>
                        <th className="p-2 text-left">Задача</th>
                        <th className="p-2 text-left">Проект</th>
                        <th className="p-2 text-right">Часы</th>
                        <th className="p-2">Оплачено</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(timelogs as ContactTimelogItem[]).map((log) => (
                        <tr key={log.id} className="border-t border-white/5">
                          <td className="p-2 text-white">
                            {new Date(log.started_at).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="p-2 text-white truncate max-w-[150px]" title={log.workitem.title}>
                            {log.workitem.title}
                          </td>
                          <td className="p-2 text-imperial-muted">{log.project.name}</td>
                          <td className="p-2 text-right">
                            {log.duration_minutes != null
                              ? (log.duration_minutes / 60).toFixed(1)
                              : '—'}
                          </td>
                          <td className="p-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs ${
                                log.is_paid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {log.is_paid ? 'Да' : 'Нет'}
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

          {activeTab === 'documents' && employee && (
            <DocumentsTab
              employeeId={employee.id}
              documents={documents as EmployeeDocument[]}
              onUpload={(formData) => uploadDocMutation.mutate({ empId: employee.id, formData })}
              onDelete={(id) => deleteDocMutation.mutate(id)}
              isUploading={uploadDocMutation.isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}
