import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { billingApi, Invoice, InvoiceCreateData } from '../api/billing';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import { useNetworkStatus } from '../components/NetworkStatus';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  sent: 'Отправлен',
  paid: 'Оплачен',
  cancelled: 'Отменён',
};

function InvoiceCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (invoice: Invoice) => void;
}) {
  const queryClient = useQueryClient();
  const isOffline = useNetworkStatus();
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => todoApi.getProjects(),
    enabled: isOpen,
  });
  const projects = projectsData?.results ?? [];

  const [projectId, setProjectId] = useState<number | ''>('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: InvoiceCreateData) => billingApi.createInvoice(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Счёт создан');
      onSuccess?.(data);
      onClose();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      const msg = typeof data === 'object' && data && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Ошибка при создании счёта';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !dateStart || !dateEnd) return;
    createMutation.mutate({
      project_id: Number(projectId),
      date_start: dateStart,
      date_end: dateEnd,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-imperial-surface border border-slate-200 dark:border-white/5 p-6 shadow-xl">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
          Создать счёт
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Проект
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2"
              required
            >
              <option value="">— Выберите проект —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Дата начала периода
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Дата окончания периода
            </label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2"
              required
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || isOffline}
              className="px-4 py-2 rounded-lg bg-imperial-gold text-black hover:bg-amber-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const isOffline = useNetworkStatus();
  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => billingApi.getInvoices(),
  });
  const invoices: Invoice[] = Array.isArray(invoicesData)
    ? invoicesData
    : (invoicesData as { results?: Invoice[] })?.results ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const downloadMutation = useMutation({
    mutationFn: (id: number) => billingApi.downloadPdf(id),
    onMutate: (id) => setDownloadingId(id),
    onSettled: () => setDownloadingId(null),
    onSuccess: () => toast.success('PDF скачан'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка скачивания'),
  });

  const markSentMutation = useMutation({
    mutationFn: (id: number) => billingApi.markAsSent(id),
    onMutate: (id) => setMarkingId(id),
    onSettled: () => setMarkingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Счёт помечен как отправленный');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  if (!currentWorkspace && !isLoading) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Нет рабочего пространства
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md mx-auto">
            Выберите пространство, чтобы управлять счетами.
          </p>
          <Link
            to="/workspaces"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium"
          >
            Перейти к пространствам
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-imperial-text font-mono">
            Счета
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {currentWorkspace && (
              <>Пространство: <Link to={`/workspaces/${currentWorkspace.id}`} className="text-primary-600 dark:text-primary-400 font-medium">{currentWorkspace.name}</Link></>
            )}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={isOffline}
          className="px-4 py-2 rounded-xl bg-imperial-gold text-black hover:bg-amber-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          + Создать счёт
        </button>
      </div>

      <section className="rounded-2xl bg-white dark:bg-imperial-surface border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-imperial-muted">
            Загрузка счетов…
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-imperial-muted">
            Счетов пока нет. Нажмите «Создать счёт» и выберите проект и период.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-imperial-muted uppercase tracking-wider">Номер</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-imperial-muted uppercase tracking-wider">Клиент</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-imperial-muted uppercase tracking-wider">Сумма</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-imperial-muted uppercase tracking-wider">Статус</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-imperial-muted uppercase tracking-wider">Дата</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-imperial-muted uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{inv.number}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.customer_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">{inv.amount_total}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${inv.status === 'draft' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200' :
                          inv.status === 'sent' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' :
                            inv.status === 'paid' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' :
                              'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.date_issue}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => downloadMutation.mutate(inv.id)}
                          disabled={downloadingId === inv.id || isOffline}
                          className="text-sm px-2 py-1 rounded border border-imperial-gold text-imperial-gold hover:bg-imperial-gold/10 disabled:opacity-50 transition-colors"
                        >
                          {downloadingId === inv.id ? '…' : 'PDF'}
                        </button>
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => markSentMutation.mutate(inv.id)}
                            disabled={markingId === inv.id || isOffline}
                            className="text-sm px-2 py-1 rounded bg-imperial-gold text-black hover:bg-amber-400 font-bold disabled:opacity-50 transition-colors"
                          >
                            {markingId === inv.id ? '…' : 'Отправлен'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <InvoiceCreateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => setModalOpen(false)}
      />
    </div>
  );
}
