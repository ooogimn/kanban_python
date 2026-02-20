import api from './client';
import type {
  Contact,
  ContactCreatePayload,
  ContactUpdatePayload,
  Department,
  EmployeeDocument,
  EmployeeProfile,
  EmployeeCreatePayload,
  EmployeeUpdatePayload,
  LeaveRequest,
  LeaveCreatePayload,
  PayrollItem,
  PayrollRun,
  PayrollPreviewItem,
  PayrollRunCreatePayload,
} from '../types/hr';

/** Контакт с полями досье (retrieve API) */
export interface ContactDetail extends Contact {
  active_projects_count: number;
  total_hours_worked: number;
  current_month_hours: number;
  projects: string[];
}

/** Элемент истории выплат */
export interface ContactPayoutItem {
  id: number;
  created_at: string;
  amount: string;
  project: { id: number; name: string };
}

/** Элемент истории времени (TimeLog) */
export interface ContactTimelogItem {
  id: number;
  started_at: string;
  duration_minutes: number | null;
  description: string;
  workitem: { id: number; title: string };
  project: { id: number; name: string };
  is_paid?: boolean;
}

export interface GetContactsParams {
  workspace_id: number;
  super_group?: 'SYSTEM' | 'NON_SYSTEM';
}

/** Элемент отчёта ведомости: контакт + проекты с неоплаченными часами */
export interface PayrollContactItem {
  contact: {
    id: number;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    user: number | null;
  };
  projects: Array<{
    project: { id: number; name: string };
    total_hours: number;
    total_amount: string;
    log_ids: number[];
  }>;
}

export interface GetPayrollStatsParams {
  workspace_id: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;
}

export interface PayPayrollPayload {
  workspace_id: number;
  project_id: number;
  contact_id: number;
  start_date: string;
  end_date: string;
  log_ids: number[];
}

export const hrApi = {
  getContacts: async (params: GetContactsParams): Promise<Contact[]> => {
    const response = await api.get<{ results?: Contact[] } | Contact[]>('/hr/contacts/', {
      params: { workspace_id: params.workspace_id, super_group: params.super_group },
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  getContact: async (id: number, workspaceId: number): Promise<Contact> => {
    const response = await api.get<Contact>(`/hr/contacts/${id}/`, {
      params: { workspace_id: workspaceId },
    });
    return response.data;
  },

  /** Детали контакта для Досье (те же поля + active_projects_count, total_hours_worked, current_month_hours, projects) */
  getContactDetails: async (id: number, workspaceId: number): Promise<ContactDetail> => {
    const response = await api.get<ContactDetail>(`/hr/contacts/${id}/`, {
      params: { workspace_id: workspaceId },
    });
    return response.data;
  },

  /** История выплат по контакту (только Director/Manager) */
  getContactPayouts: async (id: number, workspaceId: number): Promise<ContactPayoutItem[]> => {
    const response = await api.get<ContactPayoutItem[]>(`/hr/contacts/${id}/payouts/`, {
      params: { workspace_id: workspaceId },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  /** Последние 10 TimeLog по контакту (для вкладки History) */
  getContactTimelogs: async (id: number, workspaceId: number): Promise<ContactTimelogItem[]> => {
    const response = await api.get<ContactTimelogItem[]>(`/hr/contacts/${id}/timelogs/`, {
      params: { workspace_id: workspaceId },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  createContact: async (payload: ContactCreatePayload): Promise<Contact> => {
    const response = await api.post<Contact>('/hr/contacts/', payload);
    return response.data;
  },

  updateContact: async (id: number, payload: ContactUpdatePayload): Promise<Contact> => {
    const response = await api.patch<Contact>(`/hr/contacts/${id}/`, payload);
    return response.data;
  },

  deleteContact: async (id: number): Promise<void> => {
    await api.delete(`/hr/contacts/${id}/`);
  },

  /** Пригласить теневой контакт по email (ссылка на регистрацию, срок 48ч). */
  inviteContact: async (contactId: number): Promise<{ invite_url: string }> => {
    const response = await api.post<{ invite_url: string }>(`/hr/contacts/${contactId}/invite/`);
    return response.data;
  },

  /** Ведомость: неоплаченные часы по контактам и проектам за период */
  getPayrollStats: async (params: GetPayrollStatsParams): Promise<PayrollContactItem[]> => {
    const response = await api.get<PayrollContactItem[]>('/hr/payroll/stats/', {
      params: {
        workspace_id: params.workspace_id,
        start_date: params.start_date,
        end_date: params.end_date,
      },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  /** Выполнить выплату по проекту и контакту (логи помечаются оплаченными, создаётся SPEND) */
  payPayroll: async (payload: PayPayrollPayload): Promise<{ status: string; transaction_id: number; amount: string; log_count: number }> => {
    const response = await api.post<{ status: string; transaction_id: number; amount: string; log_count: number }>(
      '/hr/payroll/pay/',
      payload
    );
    return response.data;
  },

  // --- HR & Payroll Phase 1 (EmployeeProfile, Department, LeaveRequest, PayrollRun) ---

  getDepartments: async (workspaceId: number): Promise<Department[]> => {
    const response = await api.get<Department[] | { results: Department[] }>('/hr/departments/', {
      params: { workspace_id: workspaceId },
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  createDepartment: async (data: Partial<Department> & { workspace: number }): Promise<Department> => {
    const response = await api.post<Department>('/hr/departments/', data);
    return response.data;
  },

  updateDepartment: async (id: number, data: Partial<Department>): Promise<Department> => {
    const response = await api.patch<Department>(`/hr/departments/${id}/`, data);
    return response.data;
  },

  deleteDepartment: async (id: number): Promise<void> => {
    await api.delete(`/hr/departments/${id}/`);
  },

  getEmployees: async (workspaceId: number): Promise<EmployeeProfile[]> => {
    const response = await api.get<EmployeeProfile[] | { results: EmployeeProfile[] }>('/hr/employees/', {
      params: { workspace_id: workspaceId },
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  createEmployee: async (payload: EmployeeCreatePayload): Promise<EmployeeProfile> => {
    const response = await api.post<EmployeeProfile>('/hr/employees/', payload);
    return response.data;
  },

  updateEmployee: async (id: number, payload: EmployeeUpdatePayload): Promise<EmployeeProfile> => {
    const response = await api.patch<EmployeeProfile>(`/hr/employees/${id}/`, payload);
    return response.data;
  },

  deleteEmployee: async (id: number): Promise<void> => {
    await api.delete(`/hr/employees/${id}/`);
  },

  /** Табель посещения (TimeLog) по сотруднику. Director/Manager. */
  getEmployeeTimelogs: async (employeeId: number): Promise<ContactTimelogItem[]> => {
    const response = await api.get<ContactTimelogItem[]>(`/hr/employees/${employeeId}/timelogs/`);
    return Array.isArray(response.data) ? response.data : [];
  },

  getLeaveRequests: async (workspaceId: number): Promise<LeaveRequest[]> => {
    const response = await api.get<LeaveRequest[] | { results: LeaveRequest[] }>('/hr/leave-requests/', {
      params: { workspace_id: workspaceId },
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  createLeaveRequest: async (payload: LeaveCreatePayload): Promise<LeaveRequest> => {
    const response = await api.post<LeaveRequest>('/hr/leave-requests/', payload);
    return response.data;
  },

  approveLeave: async (id: number): Promise<LeaveRequest> => {
    const response = await api.post<LeaveRequest>(`/hr/leave-requests/${id}/approve/`);
    return response.data;
  },

  rejectLeave: async (id: number): Promise<LeaveRequest> => {
    const response = await api.post<LeaveRequest>(`/hr/leave-requests/${id}/reject/`);
    return response.data;
  },

  getPayrollRuns: async (workspaceId?: number): Promise<PayrollRun[]> => {
    const params = workspaceId ? { workspace_id: workspaceId } : {};
    const response = await api.get<PayrollRun[] | { results: PayrollRun[] }>('/hr/payroll-runs/', { params });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  /** Детали ведомости (с items: ФИО, должность, ставка, период, сумма). */
  getPayrollRun: async (runId: number): Promise<PayrollRun> => {
    const response = await api.get<PayrollRun>(`/hr/payroll-runs/${runId}/`);
    return response.data;
  },

  /** Корректировка строки ведомости (только Director, только DRAFT). */
  updatePayrollItem: async (itemId: number, payload: { net_amount: string | number }): Promise<PayrollItem> => {
    const response = await api.patch<PayrollItem>(`/hr/payroll-items/${itemId}/`, payload);
    return response.data;
  },

  /** Удаление строки ведомости (только Director, только DRAFT). */
  deletePayrollItem: async (itemId: number): Promise<void> => {
    await api.delete(`/hr/payroll-items/${itemId}/`);
  },

  getPayrollPreview: async (params: {
    workspace_id: number;
    period_start: string;
    period_end: string;
  }): Promise<PayrollPreviewItem[]> => {
    const response = await api.get<PayrollPreviewItem[]>('/hr/payroll-runs/preview/', { params });
    return Array.isArray(response.data) ? response.data : [];
  },

  createPayrollRun: async (payload: PayrollRunCreatePayload): Promise<PayrollRun> => {
    const response = await api.post<PayrollRun>('/hr/payroll-runs/', payload);
    return response.data;
  },

  commitPayrollRun: async (runId: number, sourceWalletId: number): Promise<PayrollRun> => {
    const response = await api.post<PayrollRun>(`/hr/payroll-runs/${runId}/commit/`, {
      source_wallet_id: sourceWalletId,
    });
    return response.data;
  },

  /** Документы сотрудника */
  getEmployeeDocuments: async (employeeId: number): Promise<EmployeeDocument[]> => {
    const response = await api.get<EmployeeDocument[] | { results: EmployeeDocument[] }>(
      '/hr/employee-documents/',
      { params: { employee_id: employeeId } }
    );
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  uploadEmployeeDocument: async (
    employeeId: number,
    formData: FormData
  ): Promise<EmployeeDocument> => {
    formData.append('employee', String(employeeId));
    const response = await api.post<EmployeeDocument>('/hr/employee-documents/', formData);
    return response.data;
  },

  deleteEmployeeDocument: async (id: number): Promise<void> => {
    await api.delete(`/hr/employee-documents/${id}/`);
  },
};
