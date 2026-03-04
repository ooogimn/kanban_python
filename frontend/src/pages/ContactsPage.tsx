import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx-js-style';
import { Maximize2, Minimize2, LayoutGrid, List } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../api/auth';
import { workspaceApi } from '../api/workspace';
import { hrApi } from '../api/hr';
import { aiApi } from '../api/ai';
import { ContactListTable, CreateContactModal, MemberDetailModal } from '../components/hr';
import type { Contact } from '../types/hr';
import type { WorkspaceAgentDto } from '../api/ai';
import { getAssetUrl } from '../utils/assetUrl';

function canSeeFinance(groups?: string[]): boolean {
  if (!groups || !Array.isArray(groups)) return false;
  return groups.includes('Director') || groups.includes('Manager');
}

export default function ContactsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [dossierContact, setDossierContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<'SYSTEM' | 'NON_SYSTEM' | 'AI_TEAM'>('SYSTEM');
  const [departmentFilter, setDepartmentFilter] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [exportLoading, setExportLoading] = useState<'jpg' | 'pdf' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });
  const groups = profile?.groups ?? [];
  const canSeeFinanceFlag = canSeeFinance(groups);

  const { data: workspaceData } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const currentWorkspace = workspaceData ?? null;
  const workspaceId = currentWorkspace?.id ?? 0;

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', workspaceId],
    queryFn: () => hrApi.getContacts({ workspace_id: workspaceId }),
    enabled: workspaceId > 0 && activeTab !== 'AI_TEAM',
  });

  const { data: workspaceAgents = [], isLoading: loadingAi } = useQuery({
    queryKey: ['ai-workspace-agents', workspaceId],
    queryFn: () => aiApi.getWorkspaceAgents(workspaceId),
    enabled: workspaceId > 0 && activeTab === 'AI_TEAM',
  });
  const aiTeamList = workspaceAgents as WorkspaceAgentDto[];

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceMembers(workspaceId),
    enabled: workspaceId > 0,
  });
  const workspaceMembers = Array.isArray(membersData) ? membersData : [];

  const { data: departments = [] } = useQuery({
    queryKey: ['hr-departments', workspaceId],
    queryFn: () => hrApi.getDepartments(workspaceId),
    enabled: workspaceId > 0 && (!!dossierContact || activeTab === 'SYSTEM'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees', workspaceId],
    queryFn: () => hrApi.getEmployees(workspaceId),
    enabled: workspaceId > 0 && activeTab === 'SYSTEM',
  });

  const contactDepartmentMap = new Map<number, number>();
  employees.forEach((emp: { member: number; department: number | null }) => {
    if (emp.department != null) {
      const member = workspaceMembers.find((m: { id: number }) => m.id === emp.member);
      if (member?.user?.id) contactDepartmentMap.set(member.user.id, emp.department);
    }
  });

  const allContacts = contacts ?? [];
  const contactUserIds = new Set(allContacts.map((c) => c.user).filter(Boolean));

  const membersWithoutContact: Contact[] = (
    activeTab === 'SYSTEM'
      ? workspaceMembers
          .filter((m: { user?: { id?: number } }) => m.user?.id && !contactUserIds.has(m.user.id))
          .map((m: { id: number; user?: { id?: number; first_name?: string; last_name?: string; email?: string; username?: string } }) => ({
            id: -m.id,
            first_name: m.user?.first_name ?? '',
            last_name: m.user?.last_name ?? '',
            email: m.user?.email ?? '',
            avatar_url: null,
            super_group: 'SYSTEM' as const,
            group: 'staff',
            guarantor: null,
            tariff_rate: null,
            currency: 'RUB',
            user: m.user?.id ?? null,
            workspace: workspaceId,
            created_at: '',
            updated_at: '',
          }))
      : []
  );

  const contactsForTab =
    activeTab === 'SYSTEM'
      ? [...allContacts.filter((c) => c.super_group === 'SYSTEM'), ...membersWithoutContact]
      : allContacts.filter((c) => c.super_group === 'NON_SYSTEM');

  const contactList =
    activeTab === 'SYSTEM' && departmentFilter !== ''
      ? contactsForTab.filter((c) => {
          if (!c.user) return false;
          const deptId = contactDepartmentMap.get(c.user);
          return deptId === departmentFilter;
        })
      : contactsForTab;

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredContactList =
    !searchLower
      ? contactList
      : contactList.filter(
          (c) =>
            `${(c.first_name ?? '')} ${(c.last_name ?? '')}`.toLowerCase().includes(searchLower) ||
            (c.email ?? '').toLowerCase().includes(searchLower)
        );

  const exportOptions = { pixelRatio: 2, cacheBust: true };
  const handleExportJpg = useCallback(() => {
    if (!pageRef.current) return;
    setExportLoading('jpg');
    toJpeg(pageRef.current, { ...exportOptions, quality: 0.95 })
      .then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `contacts-${Date.now()}.jpg`;
        a.click();
        toast.success('Сохранено в JPG');
      })
      .catch(() => toast.error('Не удалось сохранить JPG'))
      .finally(() => setExportLoading(null));
  }, []);
  const handleExportPdf = useCallback(() => {
    if (!pageRef.current) return;
    setExportLoading('pdf');
    toPng(pageRef.current, exportOptions)
      .then((dataUrl) => {
        const img = new Image();
        img.onload = () => {
          const pdf = new jsPDF({
            orientation: img.width > img.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [img.width, img.height],
          });
          pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
          pdf.save(`contacts-${Date.now()}.pdf`);
          toast.success('Сохранено в PDF');
        };
        img.src = dataUrl;
      })
      .catch(() => toast.error('Не удалось сохранить PDF'))
      .finally(() => setExportLoading(null));
  }, []);
  const handleExportExcel = useCallback(() => {
    if (activeTab === 'AI_TEAM') {
      const rows: (string | number)[][] = [['Имя', 'Роль', 'Сообщений', canSeeFinanceFlag ? 'Затраты (₽/мес)' : '—']];
      aiTeamList.forEach((wa) =>
        rows.push([
          wa.agent.name ?? '',
          wa.agent.role ?? '',
          wa.message_count ?? 0,
          canSeeFinanceFlag && wa.agent.monthly_cost != null ? Number(wa.agent.monthly_cost) : '—',
        ])
      );
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ИИ-сотрудники');
      XLSX.writeFile(wb, `contacts-ai-${Date.now()}.xlsx`);
    } else {
      const rows: (string | number)[][] = [['Имя', 'Фамилия', 'Email', 'Группа']];
      filteredContactList.forEach((c) =>
        rows.push([c.first_name ?? '', c.last_name ?? '', c.email ?? '', c.group ?? ''])
      );
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Контакты');
      XLSX.writeFile(wb, `contacts-${Date.now()}.xlsx`);
    }
    toast.success('Сохранено в Excel');
  }, [activeTab, aiTeamList, canSeeFinanceFlag, filteredContactList]);
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

  const handleRowClick = (contact: Contact) => {
    if (contact.id < 0) {
      setDossierContact(contact);
    } else {
      setEditContact(contact);
    }
  };

  const handleCloseEdit = () => {
    setEditContact(null);
  };

  if (!workspaceId) {
    return (
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
        Выберите или создайте рабочее пространство, чтобы управлять контактами.
      </div>
    );
  }

  return (
    <div ref={pageRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Контакты</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Команда, контрагенты и ИИ-сотрудники</p>
        </div>
        <div className="flex flex-nowrap items-center gap-1.5">
          {activeTab === 'AI_TEAM' ? (
            <Link
              to="/ai/marketplace"
              className="px-2 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium text-xs"
            >
              ✨ Нанять
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => { setEditContact(null); setCreateModalOpen(true); }}
              title="Добавить контакт"
              className="px-2 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium text-xs"
            >
              +
            </button>
          )}
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
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Тип:</label>
          <button type="button" onClick={() => setActiveTab('SYSTEM')} className={`px-2 py-1 text-sm rounded border ${activeTab === 'SYSTEM' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>👥 Команда</button>
          <button type="button" onClick={() => setActiveTab('NON_SYSTEM')} className={`px-2 py-1 text-sm rounded border ${activeTab === 'NON_SYSTEM' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>🏢 Контрагенты</button>
          <button type="button" onClick={() => setActiveTab('AI_TEAM')} className={`px-2 py-1 text-sm rounded border ${activeTab === 'AI_TEAM' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>✨ ИИ-сотрудники</button>
        </div>
        {activeTab !== 'AI_TEAM' && (
          <>
            <div className="min-w-0 flex-1 sm:flex-initial sm:min-w-[170px]">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Поиск</label>
              <input type="search" placeholder="Имя, фамилия, email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[11.8rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
            </div>
            {activeTab === 'SYSTEM' && departments.length > 0 && (
              <div className="min-w-0">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Отдел</label>
                <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value === '' ? '' : Number(e.target.value))} className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[8.5rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  <option value="">Все</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      {activeTab === 'AI_TEAM' ? (
        loadingAi ? (
          <div className="py-12 text-center text-imperial-muted">Загрузка ИИ-сотрудников…</div>
        ) : aiTeamList.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
            <p className="mb-4">В команде пока нет нанятых ИИ-сотрудников.</p>
            <Link
              to="/ai/marketplace"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-imperial-gold/20 text-imperial-gold font-medium hover:bg-imperial-gold/30"
            >
              Перейти в маркетплейс ИИ-агентов
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-imperial-surface/80 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-imperial-muted text-sm">
                  <th className="p-3 font-medium">Персона</th>
                  <th className="p-3 font-medium">Роль</th>
                  <th className="p-3 font-medium">Сообщений в чате</th>
                  <th className="p-3 font-medium">{canSeeFinanceFlag ? 'Затраты (учёт)' : '—'}</th>
                  <th className="p-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {aiTeamList.map((wa) => (
                  <tr key={wa.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {wa.agent.avatar_url ? (
                          <img
                            src={getAssetUrl(wa.agent.avatar_url)}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-violet-500/50"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-imperial-gold/20 text-imperial-gold flex items-center justify-center text-lg font-bold">
                            {wa.agent.name.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-white">{wa.agent.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-imperial-muted capitalize">{wa.agent.role}</td>
                    <td className="p-3 text-imperial-muted">{wa.message_count ?? 0}</td>
                    <td className="p-3">
                      {canSeeFinanceFlag
                        ? (wa.agent.monthly_cost != null && wa.agent.monthly_cost !== ''
                          ? `${Number(wa.agent.monthly_cost).toLocaleString('ru-RU')} ₽/мес`
                          : '—')
                        : '—'}
                    </td>
                    <td className="p-3">
                      <Link
                        to="/"
                        className="text-sm text-imperial-gold hover:underline"
                      >
                        Открыть чат
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-3 text-xs text-imperial-muted border-t border-white/10">
              По ИИ-сотрудникам ведётся учёт так же, как по людям: статистика, анализ и затраты для сравнения эффективности.{' '}
              <Link to="/ai/team-comparison" className="text-imperial-gold hover:underline">Сравнение: люди vs ИИ</Link>
            </p>
          </div>
        )
      ) : isLoading ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">Загрузка контактов…</div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredContactList.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => handleRowClick(c)}
              onKeyDown={(e) => e.key === 'Enter' && handleRowClick(c)}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-primary-500 dark:hover:border-primary-500 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                {c.avatar_url ? (
                  <img src={getAssetUrl(c.avatar_url)} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-600" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-lg font-bold">
                    {(c.first_name ?? '?').charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{c.email || '—'}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{c.group ?? ''}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ContactListTable
          contacts={filteredContactList}
          canSeeFinance={canSeeFinanceFlag}
          workspaceMembers={workspaceMembers}
          onRowClick={handleRowClick}
          onNameClick={(c) => setDossierContact(c)}
        />
      )}

      {createModalOpen && (
        <CreateContactModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          workspaceId={workspaceId}
          superGroup={activeTab}
          onSuccess={() => setCreateModalOpen(false)}
        />
      )}

      {editContact && (
        <CreateContactModal
          isOpen={!!editContact}
          onClose={handleCloseEdit}
          workspaceId={workspaceId}
          superGroup={editContact.super_group}
          contact={editContact}
          onSuccess={handleCloseEdit}
        />
      )}

      {dossierContact && (
        <MemberDetailModal
          isOpen={!!dossierContact}
          onClose={() => setDossierContact(null)}
          workspaceId={workspaceId}
          contact={dossierContact}
          departments={departments}
        />
      )}
    </div>
  );
}
