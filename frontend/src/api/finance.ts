import api from './client';

// Types
export type WalletType = 'bank' | 'cash' | 'crypto' | 'ewallet';

export interface Wallet {
  id: number;
  name: string;
  type: WalletType;
  currency: string;
  balance: string;
  owner: number | null;
  workspace: number | null;
  is_active: boolean;
  last_reconciled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  pnl_group: 'revenue' | 'cogs' | 'opex' | 'tax' | 'other' | 'dividends' | 'salary';
  workspace: number | null;
  parent: number | null;
  color: string;
  created_at: string;
}

export interface WalletSummary {
  id: number;
  name: string;
  type: WalletType;
  currency: string;
}

export interface UserShort {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'spend' | 'expense' | 'transfer' | 'hold' | 'release' | 'adjustment';
  status: 'pending' | 'completed' | 'cancelled';
  amount: string;
  currency: string;
  description: string;
  project: number | null;
  project_name?: string;
  workspace: number | null;
  workitem: number | null;
  workitem_title: string | null;
  category: Category | null;
  counterparty: number | null;
  source_wallet: WalletSummary | null;
  destination_wallet: WalletSummary | null;
  created_by: UserShort | null;
  created_at: string;
  transfer_group_id: string | null;
  has_receipt: boolean;
}

export interface ProjectBudgetSummary {
  project_id: number;
  project_name: string;
  budget_total: string;
  budget_spent: string;
  remaining: string;
  spent_percent: number;
  transactions_count: number;
  income_total: string;
  expense_total: string;
  hold_total: string;
}

export interface ApiResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TransactionFilters {
  wallet?: number | string;
  source_wallet?: number;
  destination_wallet?: number;
  project?: number;
  type?: Transaction['type'];
  status?: Transaction['status'];
  date_after?: string;
  date_before?: string;
  page?: number;
  ordering?: string;
  search?: string;
}

/** Сводка финансовой аналитики (GET /finance/analytics/summary/) */
export interface FinanceAnalyticsSummary {
  cash_flow_history: Array<{ month: string; income: string; expense: string }>;
  expenses_by_project: Array<{ project_id: number; project_name: string; amount: string }>;
  total_balance: string;
  has_cash_gap: boolean;
  current_month_expense: string;
}

const unwrapList = <T>(data: ApiResponse<T> | T[]): T[] => {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
};

const toFormData = (payload: Record<string, unknown>): FormData => {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) {
      form.append(key, value);
    } else {
      form.append(key, String(value));
    }
  });
  return form;
};

// Finance API
export const financeApi = {
  // Wallets
  getWallets: async (params?: { type?: WalletType; currency?: string; workspace?: number }): Promise<Wallet[]> => {
    const response = await api.get('/finance/wallets/', { params });
    return unwrapList<Wallet>(response.data);
  },

  createWallet: async (data: { name: string; type: WalletType; currency: string; workspace?: number | null }): Promise<Wallet> => {
    const response = await api.post('/finance/wallets/', data);
    return response.data;
  },

  // Categories
  getCategories: async (params?: { workspace?: number | null; type?: string }): Promise<Category[]> => {
    const response = await api.get('/finance/categories/', { params: params ?? {} });
    return unwrapList<Category>(response.data);
  },

  createCategory: async (data: {
    name: string;
    type: 'income' | 'expense';
    pnl_group?: string;
    workspace?: number | null;
    parent?: number | null;
    color?: string;
  }): Promise<Category> => {
    const response = await api.post('/finance/categories/', data);
    return response.data;
  },

  updateCategory: async (
    id: number,
    data: Partial<{ name: string; type: string; pnl_group: string; workspace: number | null; parent: number | null; color: string }>,
  ): Promise<Category> => {
    const response = await api.patch(`/finance/categories/${id}/`, data);
    return response.data;
  },

  deleteCategory: async (id: number): Promise<void> => {
    await api.delete(`/finance/categories/${id}/`);
  },

  // Transactions
  getTransactions: async (params?: TransactionFilters): Promise<ApiResponse<Transaction>> => {
    const response = await api.get('/finance/transactions/', { params });
    return response.data;
  },

  createExpense: async (data: {
    wallet: number | null;
    amount: number | string;
    project?: number | null;
    category?: number | null;
    description?: string;
    workitem?: number | null;
    receipt?: File | null;
    allow_overdraft?: boolean;
  }): Promise<Transaction> => {
    const formData = toFormData({
      wallet: data.wallet ?? '',
      amount: data.amount,
      project: data.project ?? '',
      category: data.category ?? '',
      description: data.description ?? '',
      workitem: data.workitem ?? '',
      receipt: data.receipt ?? undefined,
      allow_overdraft: data.allow_overdraft ? 'true' : '',
    });
    const response = await api.post('/finance/transactions/spend/', formData);
    return response.data;
  },

  createTransfer: async (data: {
    from_wallet: number;
    to_wallet: number;
    amount: number | string;
    target_amount?: number | string | null;
    description?: string;
    category?: number | null;
    destination_category?: number | null;
    project?: number | null;
    workitem?: number | null;
    allow_overdraft?: boolean;
  }): Promise<{ out: Transaction; in: Transaction }> => {
    const response = await api.post('/finance/transactions/transfer/', {
      ...data,
      target_amount: data.target_amount ?? null,
    });
    return response.data;
  },

  createDeposit: async (data: {
    wallet: number;
    amount: number | string;
    description?: string;
    project?: number | null;
    workitem?: number | null;
    category?: number | null;
  }): Promise<Transaction> => {
    const response = await api.post('/finance/transactions/deposit/', data);
    return response.data;
  },

  downloadReceipt: async (id: string): Promise<Blob> => {
    const response = await api.get(`/finance/transactions/${id}/receipt/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  updateTransactionMetadata: async (
    id: string,
    data: { description?: string | null; category?: number | '' | null },
  ): Promise<Transaction> => {
    const payload: Record<string, unknown> = {};
    if (data.description !== undefined) {
      payload.description = data.description;
    }
    if (data.category !== undefined) {
      payload.category = data.category === '' ? null : data.category;
    }
    const response = await api.patch(`/finance/transactions/${id}/metadata/`, payload);
    return response.data;
  },

  uploadReceipt: async (id: string, file: File): Promise<Transaction> => {
    const form = new FormData();
    form.append('receipt', file);
    const response = await api.post(`/finance/transactions/${id}/receipt/upload/`, form);
    return response.data;
  },

  // Project Budget Summary
  getProjectSummary: async (projectId: number): Promise<ProjectBudgetSummary> => {
    const response = await api.get(`/finance/projects/${projectId}/summary/`);
    return response.data;
  },

  getAllProjectsSummaries: async (): Promise<ProjectBudgetSummary[]> => {
    const response = await api.get('/finance/projects/');
    return response.data;
  },

  /** Сводка для дашборда */
  getAnalyticsSummary: async (): Promise<FinanceAnalyticsSummary> => {
    const response = await api.get('/finance/analytics/summary/');
    return response.data;
  },
};

export default financeApi;
