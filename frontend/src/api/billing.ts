import api from './client';

export interface Invoice {
  id: number;
  project: number;
  project_name: string;
  customer: number | null;
  customer_name: string | null;
  number: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  date_issue: string;
  date_due: string;
  amount_total: string;
  pdf_file: string | null;
  line_items: Array<{ title: string; hours: number; rate: string; amount: string }>;
  created_at: string;
  updated_at: string;
}

export interface InvoiceCreateData {
  project_id: number;
  date_start: string; // YYYY-MM-DD
  date_end: string;   // YYYY-MM-DD
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export const billingApi = {
  getInvoices: async (): Promise<Invoice[]> => {
    const response = await api.get('/billing/invoices/');
    const data = response.data as { results?: Invoice[] } | Invoice[];
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getInvoice: async (id: number): Promise<Invoice> => {
    const response = await api.get(`/billing/invoices/${id}/`);
    return response.data;
  },

  createInvoice: async (data: InvoiceCreateData): Promise<Invoice> => {
    const response = await api.post('/billing/invoices/', data);
    return response.data;
  },

  generatePdf: async (id: number): Promise<Invoice> => {
    const response = await api.post(`/billing/invoices/${id}/generate_pdf/`);
    return response.data;
  },

  downloadPdf: async (id: number, filename?: string): Promise<void> => {
    const response = await api.get(`/billing/invoices/${id}/download/`, {
      responseType: 'blob',
    });
    const disposition = (response.headers as Record<string, string>)['content-disposition'];
    let fname = filename ?? `invoice-${id}.pdf`;
    if (disposition) {
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      if (match) fname = match[1].trim();
    }
    downloadBlob(response.data as Blob, fname);
  },

  markAsSent: async (id: number): Promise<Invoice> => {
    const response = await api.post(`/billing/invoices/${id}/mark_as_sent/`);
    return response.data;
  },
};
