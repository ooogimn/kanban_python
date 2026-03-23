import { useEffect, useMemo, useState, useRef, useCallback, type CSSProperties } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Maximize2, Minimize2, LayoutGrid, List } from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadCsv } from '../utils/exportCsv';
import { financeApi, type Wallet, type Category, type Transaction, type FinanceAnalyticsSummary, type WalletType } from '../api/finance';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import type { Project, Workspace } from '../types';
import { FinanceChart } from '../components/charts/FinanceChart';
import { CategoryManagerModal } from '../components/finance/CategoryManagerModal';
import { TransactionList } from '../components/finance/TransactionList';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as PieTooltip,
} from 'recharts';

type FinanceTab = 'dashboard' | 'wallets' | 'transactions';
type TransactionModalMode = 'expense' | 'transfer' | 'income';

const PIE_COLORS = ['#F59E0B', '#6366F1', '#EC4899', '#10B981', '#0EA5E9', '#14B8A6', '#E11D48'];

const currencyOptions = ['RUB', 'USD', 'EUR'];
const walletTypeLabels: Record<string, string> = {
  bank: 'Банк / Карта',
  cash: 'Наличные',
  crypto: 'Crypto',
  ewallet: 'E-Wallet',
};

interface TransactionFiltersState {
  walletId: string;
  projectId: string;
  dateFrom: string;
  dateTo: string;
}

const initialFilters: TransactionFiltersState = {
  walletId: 'all',
  projectId: 'all',
  dateFrom: '',
  dateTo: '',
};

const inputClass =
  'w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 min-h-[44px] text-imperial-text placeholder-slate-500 focus:outline-none focus:border-imperial-gold/80 transition touch-manipulation';

const selectClass =
  'w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 min-h-[44px] text-imperial-text focus:outline-none focus:border-imperial-gold/80 [color-scheme:dark] touch-manipulation';

const selectOptionStyle: CSSProperties = {
  color: '#0f172a',
  backgroundColor: '#f8fafc',
};

/** Группирует категории по родителю для optgroup в select */
function GroupedCategoryOptions({ categories, emptyLabel }: { categories: Category[]; emptyLabel: string }) {
  const roots = useMemo(() => categories.filter((c) => !c.parent).sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const byParent = useMemo(() => {
    const map = new Map<number, Category[]>();
    categories
      .filter((c) => c.parent != null)
      .forEach((c) => {
        const arr = map.get(c.parent!) ?? [];
        arr.push(c);
        map.set(c.parent!, arr);
      });
    map.forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [categories]);
  const parentIds = useMemo(() => new Set(roots.map((r) => r.id)), [roots]);
  const orphanChildren = useMemo(
    () => categories.filter((c) => c.parent != null && !parentIds.has(c.parent!)).sort((a, b) => a.name.localeCompare(b.name)),
    [categories, parentIds],
  );

  return (
    <>
      <option value="" style={selectOptionStyle}>{emptyLabel}</option>
      {roots.length > 0 && (
        <optgroup label="Корневые">
          {roots.map((c) => (
            <option key={c.id} value={c.id} style={selectOptionStyle}>
              {c.name}
            </option>
          ))}
        </optgroup>
      )}
      {roots
        .filter((r) => (byParent.get(r.id)?.length ?? 0) > 0)
        .map((root) => (
          <optgroup key={root.id} label={root.name}>
            {(byParent.get(root.id) ?? []).map((child) => (
              <option key={child.id} value={child.id} style={selectOptionStyle}>
                {root.name} › {child.name}
              </option>
            ))}
          </optgroup>
        ))}
      {orphanChildren.length > 0 && (
        <optgroup label="Прочее">
          {orphanChildren.map((c) => (
            <option key={c.id} value={c.id} style={selectOptionStyle}>
              {c.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('dashboard');
  const [transactionModalMode, setTransactionModalMode] = useState<TransactionModalMode | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFiltersState>(initialFilters);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; type: string } | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [exportLoading, setExportLoading] = useState<'jpg' | 'pdf' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['finance-analytics'],
    queryFn: () => financeApi.getAnalyticsSummary(),
    staleTime: 120_000,
  });

  const { data: wallets = [], isLoading: walletsLoading } = useQuery({
    queryKey: ['finance-wallets'],
    queryFn: () => financeApi.getWallets(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['finance-categories'],
    queryFn: () => financeApi.getCategories(),
  });

  const { data: projectsResponse } = useQuery({
    queryKey: ['finance-projects'],
    queryFn: () => todoApi.getProjects({ page: 1 }),
  });
  const projects: Project[] = Array.isArray(projectsResponse)
    ? projectsResponse
    : projectsResponse?.results ?? [];

  const { data: workspacesResponse } = useQuery({
    queryKey: ['finance-workspaces'],
    queryFn: () => workspaceApi.getWorkspaces(),
  });
  const workspaces: Workspace[] = Array.isArray(workspacesResponse)
    ? workspacesResponse
    : workspacesResponse?.results ?? [];

  const { data: transactionsResponse, isLoading: transactionsLoading } = useQuery({
    queryKey: ['finance-transactions', filters],
    queryFn: () => financeApi.getTransactions({
      page: 1,
      source_wallet: filters.walletId !== 'all' ? Number(filters.walletId) : undefined,
      project: filters.projectId !== 'all' ? Number(filters.projectId) : undefined,
      date_after: filters.dateFrom || undefined,
      date_before: filters.dateTo || undefined,
      ordering: '-created_at',
    }),
  });
  const transactions = transactionsResponse?.results ?? [];

  const totalBalance = useMemo(
    () => wallets.reduce((acc, wallet) => acc + Number(wallet.balance), 0),
    [wallets],
  );

  useEffect(() => {
    let objectUrl: string | null = null;
    if (!selectedTransaction || !selectedTransaction.has_receipt) {
      setReceiptPreview(null);
      setReceiptError(null);
      setReceiptLoading(false);
      return;
    }

    setReceiptLoading(true);
    setReceiptError(null);

    financeApi
      .downloadReceipt(selectedTransaction.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setReceiptPreview({ url: objectUrl, type: blob.type || 'application/octet-stream' });
      })
      .catch(() => {
        setReceiptPreview(null);
        setReceiptError('Не удалось загрузить чек');
      })
      .finally(() => setReceiptLoading(false));

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedTransaction]);

  const lastMonthIncome = useMemo(() => {
    if (!analytics?.cash_flow_history?.length) return 0;
    const last = analytics.cash_flow_history[analytics.cash_flow_history.length - 1];
    return Number(last?.income ?? 0);
  }, [analytics]);

  const spendByCategory = useMemo(() => {
    if (!transactions.length) return [];
    const map = new Map<string, number>();
    transactions.forEach((tx) => {
      if (tx.type !== 'spend') return;
      const label = tx.category?.name ?? 'Без категории';
      map.set(label, (map.get(label) ?? 0) + Number(tx.amount));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const walletMutation = useMutation({
    mutationFn: financeApi.createWallet,
    onSuccess: () => {
      toast.success('Кошелёк создан');
      setWalletModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['finance-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['finance-analytics'] });
    },
    onError: () => toast.error('Не удалось создать кошелёк'),
  });

  const expenseMutation = useMutation({
    mutationFn: financeApi.createExpense,
    onSuccess: () => {
      toast.success('Расход зафиксирован');
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['finance-analytics'] });
      setTransactionModalMode(null);
    },
    onError: () => toast.error('Ошибка при создании расхода'),
  });

  const transferMutation = useMutation({
    mutationFn: financeApi.createTransfer,
    onSuccess: () => {
      toast.success('Перевод выполнен');
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['finance-analytics'] });
      setTransactionModalMode(null);
    },
    onError: () => toast.error('Ошибка при переводе'),
  });

  const incomeMutation = useMutation({
    mutationFn: financeApi.createDeposit,
    onSuccess: () => {
      toast.success('Доход зафиксирован');
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['finance-analytics'] });
      setTransactionModalMode(null);
    },
    onError: () => toast.error('Ошибка при фиксации дохода'),
  });

  const metadataMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { description?: string | null; category?: number | null } }) =>
      financeApi.updateTransactionMetadata(id, payload),
    onSuccess: (updated) => {
      toast.success('Детали операции обновлены');
      setSelectedTransaction(updated);
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
    },
    onError: () => toast.error('Не удалось обновить детали операции'),
  });

  const receiptUploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => financeApi.uploadReceipt(id, file),
    onSuccess: (updated) => {
      toast.success('Чек прикреплён');
      setSelectedTransaction(updated);
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
    },
    onError: () => toast.error('Не удалось загрузить чек'),
  });

  const handleDownloadReceipt = async (tx: Transaction) => {
    try {
      const blob = await financeApi.downloadReceipt(tx.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${tx.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Не удалось скачать квитанцию');
    }
  };

  const handleSubmitTransaction = (mode: TransactionModalMode, payload: Record<string, unknown>) => {
    if (mode === 'expense') {
      expenseMutation.mutate(payload as Parameters<typeof financeApi.createExpense>[0]);
    } else if (mode === 'transfer') {
      transferMutation.mutate(payload as Parameters<typeof financeApi.createTransfer>[0]);
    } else {
      incomeMutation.mutate(payload as Parameters<typeof financeApi.createDeposit>[0]);
    }
  };

  const handleCloseDetails = () => {
    setSelectedTransaction(null);
    setReceiptPreview(null);
    setReceiptError(null);
    setReceiptLoading(false);
  };

  const handleMetadataUpdate = (id: string, payload: { description?: string | null; category?: number | null }) => {
    metadataMutation.mutate({ id, payload });
  };

  const handleReceiptUpload = (id: string, file: File) => {
    receiptUploadMutation.mutate({ id, file });
  };

  const exportOptions = { pixelRatio: 2, cacheBust: true };
  const handleExportJpg = useCallback(async () => {
    if (!pageRef.current) return;
    setExportLoading('jpg');
    try {
      const { toJpeg } = await import('html-to-image');
      const dataUrl = await toJpeg(pageRef.current, { ...exportOptions, quality: 0.95 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `finance-${Date.now()}.jpg`;
      a.click();
      toast.success('Сохранено в JPG');
    } catch {
      toast.error('Не удалось сохранить JPG');
    } finally {
      setExportLoading(null);
    }
  }, []);
  const handleExportPdf = useCallback(async () => {
    if (!pageRef.current) return;
    setExportLoading('pdf');
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      const dataUrl = await toPng(pageRef.current, exportOptions);
      const img = new Image();
      img.onload = () => {
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [img.width, img.height],
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
        pdf.save(`finance-${Date.now()}.pdf`);
        toast.success('Сохранено в PDF');
      };
      img.src = dataUrl;
    } catch {
      toast.error('Не удалось сохранить PDF');
    } finally {
      setExportLoading(null);
    }
  }, []);
  const handleExportExcel = useCallback(() => {
    if (activeTab === 'wallets') {
      const rows: (string | number)[][] = [['Название', 'Тип', 'Валюта', 'Баланс']];
      wallets.forEach((w) => rows.push([w.name ?? '', w.type ?? '', w.currency ?? '', Number(w.balance ?? 0)]));
      downloadCsv(`finance-wallets-${Date.now()}.csv`, rows);
    } else if (activeTab === 'transactions') {
      const rows: (string | number)[][] = [['Дата', 'Тип', 'Описание', 'Сумма', 'Валюта', 'Категория']];
      transactions.forEach((tx) =>
        rows.push([
          tx.created_at ? new Date(tx.created_at).toLocaleString('ru-RU') : '',
          tx.type ?? '',
          tx.description ?? '',
          Number(tx.amount ?? 0),
          tx.currency ?? '',
          tx.category?.name ?? '',
        ])
      );
      downloadCsv(`finance-transactions-${Date.now()}.csv`, rows);
    } else {
      const rows: (string | number)[][] = [
        ['Показатель', 'Значение'],
        ['Совокупный баланс', totalBalance],
        ['Расход за месяц', Number(analytics?.current_month_expense ?? 0)],
        ['Доход за месяц', lastMonthIncome],
      ];
      downloadCsv(`finance-dashboard-${Date.now()}.csv`, rows);
    }
    toast.success('Сохранено в CSV');
  }, [activeTab, wallets, transactions, totalBalance, analytics?.current_month_expense, lastMonthIncome]);
  const handleFullscreen = useCallback(() => {
    if (!pageRef.current) return;
    if (!document.fullscreenElement) {
      pageRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => toast.error('Полный экран недоступен'));
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false));
    }
  }, []);
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <div ref={pageRef} className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Финансовый центр</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Сводка, кошельки и журнал операций</p>
        </div>
        <div className="flex flex-nowrap items-center gap-1.5">
          <button type="button" onClick={() => setTransactionModalMode('expense')} title="Новая операция" className="px-2 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium text-xs">+</button>
          <button type="button" onClick={() => setWalletModalOpen(true)} title="Добавить кошелёк" className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs">Кошелёк</button>
          <button type="button" onClick={() => setCategoryManagerOpen(true)} title="Настройки категорий" className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs">⚙️</button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button type="button" onClick={handleExportJpg} disabled={!!exportLoading} className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs">JPG</button>
          <button type="button" onClick={handleExportPdf} disabled={!!exportLoading} className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs">PDF</button>
          <button type="button" onClick={handleExportExcel} className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs">Excel</button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button type="button" onClick={() => setViewMode('grid')} title="Сетка" className={`p-1.5 rounded-md border ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setViewMode('list')} title="Список" className={`p-1.5 rounded-md border ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><List className="w-3.5 h-3.5" /></button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button type="button" onClick={handleFullscreen} className="p-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700" title={isFullscreen ? 'Свернуть' : 'Во весь экран'}>{isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 p-2 flex flex-wrap gap-2 items-end">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Раздел:</label>
          {(['dashboard', 'wallets', 'transactions'] as FinanceTab[]).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-2 py-1 text-sm rounded border ${activeTab === tab ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              {tab === 'dashboard' ? 'Сводка' : tab === 'wallets' ? 'Кошельки' : 'Журнал'}
            </button>
          ))}
        </div>
        {activeTab === 'transactions' && (
          <>
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Кошелёк</label>
              <select value={filters.walletId} onChange={(e) => setFilters({ ...filters, walletId: e.target.value })} className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 [color-scheme:inherit]">
                <option value="all">Все</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Проект</label>
              <select value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })} className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 [color-scheme:inherit]">
                <option value="all">Все</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Дата от</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[8.5rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Дата до</label>
              <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[8.5rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
            </div>
          </>
        )}
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-imperial-surface/95 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center h-14">
          {(['dashboard', 'wallets', 'transactions'] as FinanceTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-h-[44px] flex items-center justify-center text-sm font-medium transition ${activeTab === tab ? 'text-imperial-gold' : 'text-slate-400'}`}
            >
              {tab === 'dashboard' ? 'Сводка' : tab === 'wallets' ? 'Кошельки' : 'Журнал'}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === 'dashboard' && (
        <DashboardTab
          analytics={analytics}
          wallets={wallets}
          isLoading={analyticsLoading || walletsLoading}
          spendByCategory={spendByCategory}
          totalBalance={totalBalance}
          monthIncome={lastMonthIncome}
        />
      )}
      {activeTab === 'wallets' && (
        <WalletsTab
          wallets={wallets}
          isLoading={walletsLoading}
          openModal={() => setWalletModalOpen(true)}
        />
      )}
      {activeTab === 'transactions' && (
        <TransactionsTab
          transactions={transactions}
          isLoading={transactionsLoading}
          onDownloadReceipt={handleDownloadReceipt}
          onSelectTransaction={setSelectedTransaction}
        />
      )}

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onSubmit={walletMutation.mutate}
        isSubmitting={walletMutation.isPending}
        workspaces={workspaces}
      />

      <TransactionModal
        isOpen={transactionModalMode !== null}
        mode={transactionModalMode ?? 'expense'}
        wallets={wallets}
        categories={categories}
        projects={projects}
        isSubmitting={expenseMutation.isPending || transferMutation.isPending || incomeMutation.isPending}
        onClose={() => setTransactionModalMode(null)}
        onSubmit={handleSubmitTransaction}
      />

      <CategoryManagerModal
        isOpen={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        workspaces={workspaces}
      />

      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          onClose={handleCloseDetails}
          receiptPreview={receiptPreview}
          receiptLoading={receiptLoading}
          receiptError={receiptError}
          onDownloadReceipt={handleDownloadReceipt}
          categories={categories}
          onUpdateMetadata={handleMetadataUpdate}
          metadataPending={metadataMutation.isPending}
          onUploadReceipt={handleReceiptUpload}
          uploadPending={receiptUploadMutation.isPending}
        />
      )}

      {/* FAB — Новая операция (mobile) */}
      <button
        type="button"
        onClick={() => setTransactionModalMode('expense')}
        className="md:hidden fixed z-40 w-14 h-14 rounded-full bg-imperial-gold text-black font-bold text-2xl shadow-lg hover:bg-amber-400 active:scale-95 transition flex items-center justify-center touch-manipulation right-4"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        aria-label="Новая операция"
      >
        +
      </button>
    </div>
  );
}

function DashboardTab({
  analytics,
  wallets,
  isLoading,
  spendByCategory,
  totalBalance,
  monthIncome,
}: {
  analytics?: FinanceAnalyticsSummary;
  wallets: Wallet[];
  isLoading: boolean;
  spendByCategory: Array<{ name: string; value: number }>;
  totalBalance: number;
  monthIncome: number;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
        ))}
        <div className="h-80 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  const cashFlowData = analytics?.cash_flow_history?.map((row) => ({
    month: row.month,
    income: Number(row.income),
    expense: Number(row.expense),
  })) ?? [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Совокупный баланс" value={formatCurrency(totalBalance)} badge="Wallets" />
        <KpiCard title="Расход за месяц" value={formatCurrency(Number(analytics?.current_month_expense ?? 0))} badge="Spend" />
        <KpiCard title="Доход за месяц" value={formatCurrency(monthIncome)} badge="Income" positive />
      </div>

      <section className="rounded-2xl border border-white/10 bg-imperial-surface/80 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Кассовый поток</p>
            <h2 className="text-xl font-semibold text-imperial-text">Приход / расход (6 мес.)</h2>
          </div>
          {analytics?.has_cash_gap && (
            <span className="text-amber-400 text-sm font-semibold">⚠️ Возможен кассовый разрыв</span>
          )}
        </div>
        {cashFlowData.length ? (
          <FinanceChart data={cashFlowData} height={320} />
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500">Недостаточно данных</div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-imperial-surface/80 p-6">
          <h3 className="text-lg font-semibold text-imperial-text mb-4">Структура расходов</h3>
          {spendByCategory.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={spendByCategory} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={3}>
                  {spendByCategory.map((_, index) => (
                    <Cell key={`slice-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <PieTooltip formatter={(value: number) => `${formatCurrency(value)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500">Нет данных</div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-imperial-surface/80 p-6">
          <h3 className="text-lg font-semibold text-imperial-text mb-4">Кошельки</h3>
          <div className="space-y-3">
            {wallets.slice(0, 5).map((wallet) => (
              <div key={wallet.id} className="flex items-center justify-between rounded-xl bg-white/5 p-4">
                <div>
                  <p className="text-sm text-slate-400">{walletTypeLabels[wallet.type]}</p>
                  <p className="text-imperial-text font-semibold">{wallet.name}</p>
                </div>
                <p className="text-lg font-bold text-imperial-gold">
                  {Number(wallet.balance).toLocaleString('ru-RU')} {wallet.currency}
                </p>
              </div>
            ))}
            {wallets.length === 0 && <p className="text-slate-500 text-sm">Кошельки ещё не созданы.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function WalletsTab({
  wallets,
  isLoading,
  openModal,
}: {
  wallets: Wallet[];
  isLoading: boolean;
  openModal: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">Управляйте источниками средств и корпоративными счетами</p>
        <button
          type="button"
          onClick={openModal}
          className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:bg-white/5 transition"
        >
          Добавить кошелёк
        </button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-40 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="rounded-2xl border border-white/10 bg-imperial-surface/80 p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-slate-400">{walletTypeLabels[wallet.type]}</p>
                  <p className="text-lg font-semibold text-imperial-text">{wallet.name}</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-white/5 text-slate-300">
                  {wallet.workspace ? 'Бизнес' : 'Личный'}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-400">Баланс</p>
                <p className="text-2xl font-bold text-imperial-gold">
                  {Number(wallet.balance).toLocaleString('ru-RU')} {wallet.currency}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Обновлено {new Date(wallet.updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
              </p>
            </div>
          ))}
          {wallets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-slate-500">
              Кошельков пока нет. Нажмите «Добавить кошелёк», чтобы создать первый счёт.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TransactionsTab({
  transactions,
  isLoading,
  onDownloadReceipt,
  onSelectTransaction,
}: {
  transactions: Transaction[];
  isLoading: boolean;
  onDownloadReceipt: (tx: Transaction) => void;
  onSelectTransaction: (tx: Transaction) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Mobile: Transaction List (Feed) */}
      <div className="md:hidden">
        <TransactionList
          transactions={transactions}
          isLoading={isLoading}
          onSelectTransaction={onSelectTransaction}
        />
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Дата</th>
              <th className="px-4 py-3 text-left">Тип</th>
              <th className="px-4 py-3 text-left">Описание</th>
              <th className="px-4 py-3 text-left">Поток</th>
              <th className="px-4 py-3 text-left">Категория</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3 text-right">Файл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">Загрузка...</td>
              </tr>
            )}
            {!isLoading && transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Операций нет. Нажмите «+ Операция», чтобы создать первую запись.
                </td>
              </tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-slate-300">
                  {new Date(tx.created_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(tx.type === 'spend' || tx.type === 'expense')
                      ? 'bg-red-500/10 text-red-300'
                      : tx.type === 'deposit'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : tx.type === 'transfer'
                          ? 'bg-sky-500/10 text-sky-300'
                          : tx.type === 'hold' || tx.type === 'release'
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'bg-slate-500/10 text-slate-300'
                    }`}>
                    {(tx.type === 'spend' || tx.type === 'expense') ? 'Расход' : tx.type === 'deposit' ? 'Доход' : tx.type === 'transfer' ? 'Перевод' : tx.type === 'hold' ? 'Резерв' : tx.type === 'release' ? 'Снятие резерва' : tx.type === 'adjustment' ? 'Корректировка' : tx.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {tx.description ? (
                    <button
                      type="button"
                      onClick={() => onSelectTransaction(tx)}
                      className="text-left w-full hover:text-imperial-gold underline underline-offset-4 decoration-dotted"
                    >
                      {tx.description}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-slate-300 text-sm">
                  {tx.type === 'transfer'
                    ? `${tx.source_wallet?.name ?? '—'} → ${tx.destination_wallet?.name ?? '—'}`
                    : tx.source_wallet?.name ?? tx.project_name ?? '—'}
                </td>
                <td className="px-4 py-3 text-slate-300">{tx.category?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  <span className={(tx.type === 'spend' || tx.type === 'expense') ? 'text-red-300' : tx.type === 'deposit' ? 'text-emerald-300' : 'text-sky-300'}>
                    {Number(tx.amount).toLocaleString('ru-RU')} {tx.currency}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {tx.has_receipt ? (
                    <button
                      type="button"
                      onClick={() => onDownloadReceipt(tx)}
                      className="text-slate-300 hover:text-imperial-gold transition"
                    >
                      📎
                    </button>
                  ) : (
                    <span className="text-slate-500 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WalletModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  workspaces,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; type: WalletType; currency: string; workspace?: number | null }) => void;
  isSubmitting: boolean;
  workspaces: Workspace[];
}) {
  const [form, setForm] = useState({ name: '', type: 'bank' as WalletType, currency: 'RUB', workspace: '' });

  useEffect(() => {
    if (!isOpen) {
      setForm({ name: '', type: 'bank', currency: 'RUB', workspace: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Введите название кошелька');
      return;
    }
    onSubmit({
      name: form.name.trim(),
      type: form.type,
      currency: form.currency,
      workspace: form.workspace ? Number(form.workspace) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full max-w-md md:max-h-[90vh] md:rounded-2xl rounded-t-3xl bg-imperial-surface border border-white/10 border-b-0 md:border-b p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between min-h-[44px]">
          <h3 className="text-lg font-semibold text-imperial-text">Новый кошелёк</h3>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-slate-400 hover:text-white touch-manipulation">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase text-slate-400">Название</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className={`mt-1 ${inputClass}`}
              placeholder="Например, Сбербанк •••• 1234"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase text-slate-400">Тип</label>
              <select
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as WalletType }))}
                className={`mt-1 ${selectClass}`}
              >
                {Object.entries(walletTypeLabels).map(([key, label]) => (
                  <option key={key} value={key} style={selectOptionStyle}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase text-slate-400">Валюта</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                className={`mt-1 ${selectClass}`}
              >
                {currencyOptions.map((cur) => (
                  <option key={cur} value={cur} style={selectOptionStyle}>{cur}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-400">Workspace (опционально)</label>
            <select
              value={form.workspace}
              onChange={(e) => setForm((prev) => ({ ...prev, workspace: e.target.value }))}
              className={`mt-1 ${selectClass}`}
            >
              <option value="" style={selectOptionStyle}>Личный кошелёк</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id} style={selectOptionStyle}>{ws.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 touch-manipulation"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-imperial-gold text-black font-semibold disabled:opacity-50 touch-manipulation"
            >
              {isSubmitting ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransactionModal({
  isOpen,
  mode,
  onClose,
  wallets,
  categories,
  projects,
  isSubmitting,
  onSubmit,
}: {
  isOpen: boolean;
  mode: TransactionModalMode;
  onClose: () => void;
  wallets: Wallet[];
  categories: Category[];
  projects: Project[];
  isSubmitting: boolean;
  onSubmit: (mode: TransactionModalMode, payload: Record<string, unknown>) => void;
}) {
  const [activeTab, setActiveTab] = useState<TransactionModalMode>(mode);
  const [expenseForm, setExpenseForm] = useState({
    wallet: '',
    amount: '',
    project: '',
    category: '',
    description: '',
    receipt: null as File | null,
  });
  const [transferForm, setTransferForm] = useState({
    from_wallet: '',
    to_wallet: '',
    amount: '',
    description: '',
  });
  const [incomeForm, setIncomeForm] = useState({
    wallet: '',
    amount: '',
    category: '',
    description: '',
  });

  useEffect(() => {
    setActiveTab(mode);
  }, [mode]);

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  if (!isOpen) return null;

  const handleExpenseSubmit = () => {
    if (!expenseForm.amount) {
      toast.error('Введите сумму');
      return;
    }
    onSubmit('expense', {
      wallet: expenseForm.wallet ? Number(expenseForm.wallet) : null,
      amount: expenseForm.amount,
      project: expenseForm.project ? Number(expenseForm.project) : null,
      category: expenseForm.category ? Number(expenseForm.category) : null,
      description: expenseForm.description,
      receipt: expenseForm.receipt,
    });
  };

  const handleTransferSubmit = () => {
    if (!transferForm.amount || !transferForm.from_wallet || !transferForm.to_wallet) {
      toast.error('Заполните кошельки и сумму');
      return;
    }
    if (transferForm.from_wallet === transferForm.to_wallet) {
      toast.error('Нельзя переводить в тот же кошелёк');
      return;
    }
    onSubmit('transfer', {
      from_wallet: Number(transferForm.from_wallet),
      to_wallet: Number(transferForm.to_wallet),
      amount: transferForm.amount,
      description: transferForm.description,
    });
  };

  const handleIncomeSubmit = () => {
    if (!incomeForm.wallet || !incomeForm.amount) {
      toast.error('Выберите кошелёк и сумму');
      return;
    }
    onSubmit('income', {
      wallet: Number(incomeForm.wallet),
      amount: incomeForm.amount,
      description: incomeForm.description,
      category: incomeForm.category ? Number(incomeForm.category) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full max-w-2xl md:max-h-[90vh] md:rounded-3xl rounded-t-3xl bg-imperial-surface border border-white/10 border-b-0 md:border-b p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between min-h-[44px]">
          <div>
            <p className="text-xs uppercase text-slate-400">Новая операция</p>
            <h3 className="text-xl font-semibold text-imperial-text">Ledger Entry</h3>
          </div>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-slate-400 hover:text-white touch-manipulation">✕</button>
        </div>

        <div className="flex gap-2">
          {(['expense', 'transfer', 'income'] as TransactionModalMode[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-xl px-3 py-2 min-h-[44px] text-sm font-medium touch-manipulation ${activeTab === tab ? 'bg-imperial-gold text-black' : 'bg-white/5 text-slate-300'}`}
            >
              {tab === 'expense' ? 'Расход' : tab === 'transfer' ? 'Перевод' : 'Доход'}
            </button>
          ))}
        </div>

        {activeTab === 'expense' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={expenseForm.wallet}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, wallet: e.target.value }))}
                className={selectClass}
              >
                <option value="" style={selectOptionStyle}>Проектный расход (без кошелька)</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id} style={selectOptionStyle}>{wallet.name}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Сумма"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={expenseForm.project}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, project: e.target.value }))}
                className={selectClass}
              >
                <option value="" style={selectOptionStyle}>Без проекта</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id} style={selectOptionStyle}>{project.name}</option>
                ))}
              </select>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                className={selectClass}
              >
                <GroupedCategoryOptions categories={expenseCategories} emptyLabel="Категория" />
              </select>
            </div>
            <div>
              <label className="text-xs uppercase text-slate-400 block mb-1">Назначение платежа</label>
              <textarea
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
                className={`${inputClass} min-h-[96px]`}
                placeholder="Например: Предоплата за дизайн, Танцы Ульяне..."
              />
            </div>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, receipt: e.target.files?.[0] ?? null }))}
              className="text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-imperial-gold file:px-3 file:py-1 file:text-black"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="min-h-[44px] px-4 py-2 rounded-xl border border-white/10 text-slate-300 touch-manipulation">
                Отмена
              </button>
              <button
                type="button"
                onClick={handleExpenseSubmit}
                disabled={isSubmitting}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-imperial-gold text-black font-semibold disabled:opacity-50 touch-manipulation"
              >
                {isSubmitting ? 'Сохранение…' : 'Зафиксировать'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'transfer' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={transferForm.from_wallet}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, from_wallet: e.target.value }))}
                className={selectClass}
              >
                <option value="" style={selectOptionStyle}>Откуда</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id} style={selectOptionStyle}>{wallet.name}</option>
                ))}
              </select>
              <select
                value={transferForm.to_wallet}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, to_wallet: e.target.value }))}
                className={selectClass}
              >
                <option value="" style={selectOptionStyle}>Куда</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id} style={selectOptionStyle}>{wallet.name}</option>
                ))}
              </select>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={transferForm.amount}
              onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))}
              className={inputClass}
              placeholder="Сумма перевода"
            />
            <div>
              <label className="text-xs uppercase text-slate-400 block mb-1">Назначение платежа</label>
              <textarea
                value={transferForm.description}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, description: e.target.value }))}
                className={`${inputClass} min-h-[96px]`}
                placeholder="Назначение перевода"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="min-h-[44px] px-4 py-2 rounded-xl border border-white/10 text-slate-300 touch-manipulation">
                Отмена
              </button>
              <button
                type="button"
                onClick={handleTransferSubmit}
                disabled={isSubmitting}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-imperial-gold text-black font-semibold disabled:opacity-50 touch-manipulation"
              >
                {isSubmitting ? 'Перевод…' : 'Перевести'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'income' && (
          <div className="space-y-3">
            <select
              value={incomeForm.wallet}
              onChange={(e) => setIncomeForm((prev) => ({ ...prev, wallet: e.target.value }))}
              className={selectClass}
            >
              <option value="" style={selectOptionStyle}>Кошелек зачисления</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id} style={selectOptionStyle}>{wallet.name}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={incomeForm.amount}
              onChange={(e) => setIncomeForm((prev) => ({ ...prev, amount: e.target.value }))}
              className={inputClass}
              placeholder="Сумма дохода"
            />
            <select
              value={incomeForm.category}
              onChange={(e) => setIncomeForm((prev) => ({ ...prev, category: e.target.value }))}
              className={selectClass}
            >
              <GroupedCategoryOptions categories={incomeCategories} emptyLabel="Категория" />
            </select>
            <div>
              <label className="text-xs uppercase text-slate-400 block mb-1">Назначение платежа</label>
              <textarea
                value={incomeForm.description}
                onChange={(e) => setIncomeForm((prev) => ({ ...prev, description: e.target.value }))}
                className={`${inputClass} min-h-[96px]`}
                placeholder="Назначение дохода"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="min-h-[44px] px-4 py-2 rounded-xl border border-white/10 text-slate-300 touch-manipulation">
                Отмена
              </button>
              <button
                type="button"
                onClick={handleIncomeSubmit}
                disabled={isSubmitting}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-imperial-gold text-black font-semibold disabled:opacity-50 touch-manipulation"
              >
                {isSubmitting ? 'Добавление…' : 'Зачислить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionDetailsModal({
  transaction,
  onClose,
  receiptPreview,
  receiptLoading,
  receiptError,
  onDownloadReceipt,
  categories,
  onUpdateMetadata,
  metadataPending,
  onUploadReceipt,
  uploadPending,
}: {
  transaction: Transaction;
  onClose: () => void;
  receiptPreview: { url: string; type: string } | null;
  receiptLoading: boolean;
  receiptError: string | null;
  onDownloadReceipt: (tx: Transaction) => void;
  categories: Category[];
  onUpdateMetadata: (id: string, payload: { description?: string | null; category?: number | null }) => void;
  metadataPending: boolean;
  onUploadReceipt: (id: string, file: File) => void;
  uploadPending: boolean;
}) {
  const isPdf = receiptPreview?.type?.includes('pdf');
  const [editDescription, setEditDescription] = useState(transaction.description ?? '');
  const [editCategory, setEditCategory] = useState(transaction.category?.id ? String(transaction.category.id) : '');

  useEffect(() => {
    setEditDescription(transaction.description ?? '');
    setEditCategory(transaction.category?.id ? String(transaction.category.id) : '');
  }, [transaction]);

  const handleMetadataSave = () => {
    onUpdateMetadata(transaction.id, {
      description: editDescription,
      category: editCategory ? Number(editCategory) : null,
    });
  };

  const handleReceiptInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUploadReceipt(transaction.id, file);
      event.target.value = '';
    }
  };

  const editCategories =
    transaction.type === 'spend'
      ? categories.filter((c) => c.type === 'expense')
      : transaction.type === 'deposit'
        ? categories.filter((c) => c.type === 'income')
        : categories;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full max-w-4xl md:max-h-[90vh] md:rounded-3xl rounded-t-3xl bg-imperial-surface border border-white/10 border-b-0 md:border-b p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 min-h-[44px]">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Детали операции</p>
            <h3 className="text-xl md:text-2xl font-semibold text-imperial-text">{transaction.description || 'Без описания'}</h3>
            <p className="text-sm text-slate-400 mt-1">
              {new Date(transaction.created_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-slate-400 hover:text-white touch-manipulation">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                  transaction.type === 'spend'
                    ? 'bg-red-500/10 text-red-300'
                    : transaction.type === 'deposit'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : transaction.type === 'transfer'
                        ? 'bg-sky-500/10 text-sky-300'
                        : 'bg-slate-500/10 text-slate-300'
                }`}
              >
                {transaction.type}
              </span>
              <span className="text-lg font-bold text-imperial-gold">
                {formatCurrency(Number(transaction.amount))} {transaction.currency}
              </span>
            </div>
            <dl className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Источник</dt>
                <dd>{transaction.source_wallet?.name ?? transaction.project_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Назначение</dt>
                <dd>{transaction.destination_wallet?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Категория</dt>
                <dd>{transaction.category?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Статус</dt>
                <dd className="capitalize">{transaction.status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Создал</dt>
                <dd>{transaction.created_by?.username ?? '—'}</dd>
              </div>
            </dl>
            {transaction.description && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-slate-500 mb-2">Назначение / Описание</p>
                <p className="text-sm text-slate-200">{transaction.description}</p>
              </div>
            )}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <p className="text-xs uppercase text-slate-500">Корректировка деталей</p>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Назначение платежа</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className={`${inputClass} min-h-[80px]`}
                  placeholder="Назначение / основание"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Категория</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className={selectClass}
                >
                  <GroupedCategoryOptions categories={editCategories} emptyLabel="Без категории" />
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleMetadataSave}
                  disabled={metadataPending}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-imperial-gold text-black font-semibold disabled:opacity-50 touch-manipulation"
                >
                  {metadataPending ? 'Сохранение…' : 'Сохранить детали'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm uppercase tracking-wide text-slate-400">Чек / счёт</h4>
              {transaction.has_receipt && (
                <button
                  type="button"
                  onClick={() => onDownloadReceipt(transaction)}
                  className="text-xs px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5 text-slate-200"
                >
                  Скачать чек
                </button>
              )}
            </div>
            {!transaction.has_receipt && (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-500 space-y-3">
                <p>Квитанция не прикреплена.</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-slate-200 hover:bg-white/5 cursor-pointer">
                  <input
                    key={transaction.id}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleReceiptInput}
                    disabled={uploadPending}
                    className="hidden"
                  />
                  {uploadPending ? 'Загрузка…' : 'Добавить чек'}
                </label>
              </div>
            )}
            {transaction.has_receipt && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 min-h-[220px] flex items-center justify-center relative">
                {receiptLoading && <p className="text-slate-400 text-sm">Загружаем превью…</p>}
                {!receiptLoading && receiptError && <p className="text-red-400 text-sm">{receiptError}</p>}
                {!receiptLoading && !receiptError && receiptPreview && (
                  <>
                    {isPdf ? (
                      <object
                        data={receiptPreview.url}
                        type={receiptPreview.type}
                        className="w-full h-64 rounded-xl border border-white/10"
                      >
                        <p className="text-slate-400 text-sm">PDF не может быть отображён. Используйте кнопку скачивания.</p>
                      </object>
                    ) : (
                      <img
                        src={receiptPreview.url}
                        alt="Чек"
                        className="max-h-64 w-full object-contain rounded-xl border border-white/10"
                      />
                    )}
                  </>
                )}
                {!receiptLoading && !receiptError && !receiptPreview && transaction.has_receipt && (
                  <p className="text-slate-400 text-sm">Превью появится после загрузки.</p>
                )}
                {!receiptLoading && !receiptError && receiptPreview && (
                  <label className="absolute top-2 right-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-white/10 text-xs text-slate-200 hover:bg-white/5 cursor-pointer bg-imperial-surface/90">
                    <input
                      key={`${transaction.id}-replace`}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleReceiptInput}
                      disabled={uploadPending}
                      className="hidden"
                    />
                    {uploadPending ? 'Обновляем…' : 'Заменить чек'}
                  </label>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, badge, positive }: { title: string; value: string; badge?: string; positive?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-imperial-surface/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-slate-400">{badge ?? 'Metric'}</p>
        <span className="text-xs text-slate-500">{new Date().toLocaleDateString('ru-RU')}</span>
      </div>
      <p className="text-sm text-slate-400">{title}</p>
      <p className={`text-2xl font-semibold ${positive ? 'text-emerald-300' : 'text-imperial-text'}`}>{value}</p>
    </div>
  );
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 0 })} ₽`;
}
