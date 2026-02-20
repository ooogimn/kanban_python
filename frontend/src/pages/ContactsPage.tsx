import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Контакты</h1>
        {activeTab === 'AI_TEAM' ? (
          <Link
            to="/ai/marketplace"
            className="px-4 py-2 rounded-xl bg-imperial-gold/20 text-imperial-gold font-medium hover:bg-imperial-gold/30 border border-imperial-gold/40 transition-colors"
          >
            ✨ Нанять ИИ-агента
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditContact(null);
              setCreateModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 transition-colors"
          >
            + Добавить контакт
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('SYSTEM')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'SYSTEM'
              ? 'bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40'
              : 'text-imperial-muted hover:text-white hover:bg-white/5'
            }`}
        >
          👥 Команда
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('NON_SYSTEM')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'NON_SYSTEM'
              ? 'bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40'
              : 'text-imperial-muted hover:text-white hover:bg-white/5'
            }`}
        >
          🏢 Контрагенты
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('AI_TEAM')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'AI_TEAM'
              ? 'bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40'
              : 'text-imperial-muted hover:text-white hover:bg-white/5'
            }`}
        >
          ✨ ИИ-сотрудники
        </button>
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
        <div className="py-12 text-center text-imperial-muted">Загрузка контактов…</div>
      ) : (
        <>
          {activeTab === 'SYSTEM' && departments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-imperial-muted">Отдел:</span>
              <button
                type="button"
                onClick={() => setDepartmentFilter('')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  departmentFilter === ''
                    ? 'bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40'
                    : 'bg-white/5 text-imperial-muted hover:text-white'
                }`}
              >
                Все
              </button>
              {departments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDepartmentFilter(d.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    departmentFilter === d.id
                      ? 'bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40'
                      : 'bg-white/5 text-imperial-muted hover:text-white'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
          <ContactListTable
          contacts={contactList}
          canSeeFinance={canSeeFinanceFlag}
          workspaceMembers={workspaceMembers}
          onRowClick={handleRowClick}
          onNameClick={(c) => setDossierContact(c)}
        />
        </>
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
