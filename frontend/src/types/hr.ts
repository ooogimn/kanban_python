/**
 * HR Contact — тип из API.
 * is_shadow НЕ приходит с бэкенда: вычисляется на клиенте как !contact.user.
 * (user — id пользователя или null; если null — теневой контакт.)
 */
export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  super_group: 'SYSTEM' | 'NON_SYSTEM';
  group: string;
  /** ID пользователя-поручителя (user id). */
  guarantor: number | null;
  tariff_rate: string | number | null;
  currency: string;
  /** ID пользователя в системе (null = теневой). */
  user: number | null;
  workspace: number;
  hr_role?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

/** Полезная производная: теневой контакт (без системного пользователя). */
export function isShadowContact(contact: Contact): boolean {
  return !contact.user;
}

export type ContactCreatePayload = Omit<Partial<Contact>, 'id' | 'created_at' | 'updated_at' | 'avatar_url'> & {
  workspace: number;
  super_group: Contact['super_group'];
  first_name?: string;
  last_name?: string;
  email?: string;
  group?: string;
  hr_role?: string;
  guarantor?: number | null;
  user?: number | null;
  tariff_rate?: number | string | null;
  currency?: string;
  phone?: string;
};

export type ContactUpdatePayload = Partial<ContactCreatePayload>;

// --- HR & Payroll Phase 1 (EmployeeProfile, Department, LeaveRequest, PayrollRun) ---

export interface Department {
  id: number;
  workspace: number;
  name: string;
  head: number | null;
  parent: number | null;
  is_active: boolean;
}

export type EmployeeStatus = 'ACTIVE' | 'ONBOARDING' | 'ON_LEAVE' | 'TERMINATED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR';
export type SalaryMode = 'FIXED' | 'HOURLY';

export interface EmployeeProfile {
  id: number;
  member: number;
  department: number | null;
  job_title: string;
  status: EmployeeStatus;
  date_hired: string | null;
  date_terminated: string | null;
  employment_type: EmploymentType;
  fte: string;
  salary_mode: SalaryMode;
  salary_amount: string | null;
  currency: string;
  payment_wallet: number | null;
  settings: Record<string, unknown>;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCreatePayload {
  member: number;
  department?: number | null;
  job_title?: string;
  status?: EmployeeStatus;
  date_hired?: string | null;
  date_terminated?: string | null;
  employment_type?: EmploymentType;
  fte?: number | string;
  salary_mode?: SalaryMode;
  salary_amount?: number | string | null;
  currency?: string;
  payment_wallet?: number | null;
}

export type EmployeeUpdatePayload = Partial<EmployeeCreatePayload>;

export type LeaveType = 'VACATION' | 'SICK_LEAVE' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  id: number;
  member: number;
  type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  approved_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveCreatePayload {
  member: number;
  type: LeaveType;
  start_date: string;
  end_date: string;
}

export interface PayrollItem {
  id: number;
  employee: number;
  employee_display: string;
  job_title?: string;
  salary_rate?: string | null;
  gross_amount: string;
  net_amount: string;
  days_worked: string | null;
  hours_worked: string | null;
  calculation_details: Record<string, unknown>;
  transaction: number | null;
  is_paid: boolean;
}

export type PayrollRunStatus = 'DRAFT' | 'PAID';

export interface PayrollRun {
  id: number;
  workspace: number;
  period_start: string;
  period_end: string;
  total_amount: string;
  currency: string;
  status: PayrollRunStatus;
  created_by: number;
  created_at: string;
  paid_at: string | null;
  items: PayrollItem[];
}

export interface PayrollPreviewItem {
  employee_id: number;
  display_name: string;
  gross_amount: string;
  net_amount: string;
  days_worked: number | null;
  hours_worked: number | null;
  calculation_details: Record<string, unknown>;
  currency: string;
  has_wallet: boolean;
}

export interface PayrollRunCreatePayload {
  workspace_id: number;
  period_start: string;
  period_end: string;
  currency?: string;
}

export type EmployeeDocumentType = 'OFFER' | 'CONTRACT' | 'NDA' | 'PASSPORT' | 'OTHER';

export interface EmployeeDocument {
  id: number;
  employee: number;
  doc_type: EmployeeDocumentType;
  file: string;
  file_url: string;
  name: string;
  created_at: string;
}
