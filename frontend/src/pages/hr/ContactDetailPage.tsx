import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authApi } from '../../api/auth';
import { workspaceApi } from '../../api/workspace';
import { hrApi, type ContactDetail, type ContactPayoutItem, type ContactTimelogItem } from '../../api/hr';
import { CreateContactModal, MemberDetailModal } from '../../components/hr';
import { isShadowContact } from '../../types/hr';

function canSeeFinance(groups?: string[]): boolean {
  if (!groups || !Array.isArray(groups)) return false;
  return groups.includes('Director') || groups.includes('Manager');
}

function displayName(c: ContactDetail): string {
  const name = [c.last_name, c.first_name].filter(Boolean).join(' ').trim();
  return name || c.email || `Контакт #${c.id}`;
}

type TabId = 'overview' | 'history' | 'finance';

const DOSSIER_TABS = ['profile', 'hr', 'payroll', 'timeoff', 'documents'] as const;

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = searchParams.get('tab');
  const dossierTab = DOSSIER_TABS.includes(tabParam as (typeof DOSSIER_TABS)[number])
    ? (tabParam as (typeof DOSSIER_TABS)[number])
    : null;

  const contactId = id ? parseInt(id, 10) : 0;
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();

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
  const workspaceId = workspaceData?.id ?? 0;

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact-detail', contactId, workspaceId],
    queryFn: () => hrApi.getContactDetails(contactId, workspaceId),
    enabled: contactId > 0 && workspaceId > 0,
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['contact-payouts', contactId, workspaceId],
    queryFn: () => hrApi.getContactPayouts(contactId, workspaceId),
    enabled: contactId > 0 && workspaceId > 0 && canSeeFinanceFlag,
  });

  const { data: timelogs = [] } = useQuery({
    queryKey: ['contact-timelogs', contactId, workspaceId],
    queryFn: () => hrApi.getContactTimelogs(contactId, workspaceId),
    enabled: contactId > 0 && workspaceId > 0,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['hr-departments', workspaceId],
    queryFn: () => hrApi.getDepartments(workspaceId),
    enabled: workspaceId > 0 && !!dossierTab && !!contact,
  });

  if (!workspaceId) {
    return (
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
        Выберите рабочее пространство.
      </div>
    );
  }

  if (contactId <= 0 || isNaN(contactId)) {
    return (
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
        Неверный ID контакта.
      </div>
    );
  }

  if (isLoading || !contact) {
    return (
      <div className="flex items-center justify-center min-h-[320px] text-imperial-muted">
        Загрузка…
      </div>
    );
  }

  const name = displayName(contact);
  const isShadow = isShadowContact(contact);

  if (dossierTab && contact) {
    return (
      <div className="space-y-4">
        <Link
          to={`/hr/contacts/${contactId}`}
          className="text-sm text-imperial-muted hover:text-imperial-gold transition-colors inline-block"
        >
          ← К полной странице контакта
        </Link>
        <MemberDetailModal
          isOpen
          onClose={() => navigate(`/hr/contacts/${contactId}`, { replace: true })}
          workspaceId={workspaceId}
          contact={contact}
          departments={departments}
          initialTab={dossierTab}
        />
      </div>
    );
  }
  const rateDisplay =
    contact.tariff_rate != null && contact.tariff_rate !== ''
      ? `${Number(contact.tariff_rate)} ${contact.currency || 'RUB'}`
      : '—';

  return (
    <div className="space-y-6">
      <Link
        to="/contacts"
        className="text-sm text-imperial-muted hover:text-imperial-gold transition-colors inline-block"
      >
        ← Назад к контактам
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-white/10 bg-imperial-surface/60 p-6">
        <div className="flex items-center gap-4 flex-wrap">
          {contact.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt=""
              className="w-20 h-20 rounded-2xl object-cover border border-white/10"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-imperial-gold/20 border border-imperial-gold/30 flex items-center justify-center text-imperial-gold text-2xl font-bold">
              {name[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{name}</h1>
            <p className="text-imperial-muted text-sm mt-0.5">
              {contact.hr_role || contact.group || (contact.super_group === 'SYSTEM' ? 'Staff' : 'Partner')}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isShadow ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}
              >
                {isShadow ? 'Shadow' : 'Active'}
              </span>
              <span className="inline-flex px-2 py-0.5 rounded-lg bg-white/10 text-imperial-muted text-xs">
                {contact.super_group === 'SYSTEM' ? 'Staff' : 'Contractor'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors font-medium"
          >
            Редактировать
          </button>
          {isShadow && contact.email && (
            <button
              type="button"
              onClick={() => {
                hrApi.inviteContact(contact.id).then(({ invite_url }) => {
                  navigator.clipboard.writeText(invite_url);
                  toast.success('Ссылка скопирована');
                }).catch(() => toast.error('Ошибка приглашения'));
              }}
              className="px-4 py-2 rounded-xl bg-imperial-gold/20 text-imperial-gold border border-imperial-gold/40 hover:bg-imperial-gold/30 transition-colors font-medium"
            >
              Пригласить
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-4">
          <p className="text-imperial-muted text-xs uppercase tracking-wider">Всего часов</p>
          <p className="text-xl font-bold text-imperial-gold mt-1">
            {contact.total_hours_worked ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-4">
          <p className="text-imperial-muted text-xs uppercase tracking-wider">Часы в этом месяце</p>
          <p className="text-xl font-bold text-white mt-1">
            {contact.current_month_hours ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-4">
          <p className="text-imperial-muted text-xs uppercase tracking-wider">Проектов</p>
          <p className="text-xl font-bold text-white mt-1">
            {contact.active_projects_count ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-4">
          <p className="text-imperial-muted text-xs uppercase tracking-wider">Текущая ставка</p>
          <p className="text-xl font-bold text-white mt-1">
            {canSeeFinanceFlag ? rateDisplay : '—'}
          </p>
        </div>
      </div>

      {/* Занятость и план/факт по задачам (учётная карточка ответственного) */}
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-4">
        <h2 className="text-lg font-semibold text-white mb-2">Занятость и выполнение по задачам</h2>
        <p className="text-imperial-muted text-sm mb-2">
          Сводка по времени: <strong className="text-white">Всего часов</strong> и <strong className="text-white">Часы в этом месяце</strong> — выше. История записей времени — во вкладке «История».
        </p>
        <p className="text-imperial-muted text-sm mb-2">
          <strong className="text-white">Занят сейчас:</strong> на доске канбана у задач, где этот участник ответственный, отображается таймер (запущен/на паузе). Завершённые задачи помечены финишным временем синим.
        </p>
        <p className="text-imperial-muted text-sm">
          <strong className="text-white">План и факт:</strong> на карточках задач на доске канбана у завершённых задач — индикатор <span className="text-green-400">!!!</span> (в графике: старт и завершение в плановые сроки) или <span className="text-red-400">??</span> (вне графика). При наведении отображается подсказка с плановыми и фактическими датами.
        </p>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 overflow-hidden">
        <div className="flex border-b border-white/10">
          {(['overview', 'history', 'finance'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab
                  ? 'bg-imperial-gold/20 text-imperial-gold border-b-2 border-imperial-gold'
                  : 'text-imperial-muted hover:text-white hover:bg-white/5'
                }`}
            >
              {tab === 'overview' ? 'Проекты' : tab === 'history' ? 'История' : 'Выплаты'}
            </button>
          ))}
        </div>
        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="flex flex-wrap gap-3">
              {(contact.projects ?? []).length === 0 ? (
                <p className="text-imperial-muted">Нет активных проектов</p>
              ) : (
                (contact.projects ?? []).map((projectName) => (
                  <span
                    key={projectName}
                    className="inline-flex px-4 py-2 rounded-xl bg-white/10 text-white font-medium"
                  >
                    {projectName}
                  </span>
                ))
              )}
            </div>
          )}
          {activeTab === 'history' && (
            <div className="overflow-x-auto">
              {timelogs.length === 0 ? (
                <p className="text-imperial-muted">Нет записей времени</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-imperial-muted">
                      <th className="pb-2 pr-4">Дата</th>
                      <th className="pb-2 pr-4">Задача</th>
                      <th className="pb-2 pr-4">Проект</th>
                      <th className="pb-2 pr-4 text-right">Минуты</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(timelogs as ContactTimelogItem[]).map((log) => (
                      <tr key={log.id} className="border-b border-white/5">
                        <td className="py-2 pr-4 text-white">
                          {new Date(log.started_at).toLocaleString('ru-RU')}
                        </td>
                        <td className="py-2 pr-4 text-white">{log.workitem?.title ?? '—'}</td>
                        <td className="py-2 pr-4 text-imperial-muted">{log.project?.name ?? '—'}</td>
                        <td className="py-2 pr-4 text-right text-imperial-gold">
                          {log.duration_minutes ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {activeTab === 'finance' && (
            <>
              {!canSeeFinanceFlag ? (
                <p className="text-imperial-muted">Нет прав на просмотр выплат</p>
              ) : (payouts as ContactPayoutItem[]).length === 0 ? (
                <p className="text-imperial-muted">Нет выплат</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-imperial-muted">
                      <th className="pb-2 pr-4">Дата</th>
                      <th className="pb-2 pr-4">Сумма</th>
                      <th className="pb-2 pr-4">Проект</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payouts as ContactPayoutItem[]).map((p) => (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="py-2 pr-4 text-white">
                          {new Date(p.created_at).toLocaleString('ru-RU')}
                        </td>
                        <td className="py-2 pr-4 text-imperial-gold font-medium">{p.amount} ₽</td>
                        <td className="py-2 pr-4 text-imperial-muted">{p.project?.name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {editOpen && (
        <CreateContactModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          workspaceId={workspaceId}
          superGroup={contact.super_group}
          contact={contact}
          onSuccess={() => {
            setEditOpen(false);
            queryClient.invalidateQueries({ queryKey: ['contact-detail', contactId, workspaceId] });
          }}
        />
      )}
    </div>
  );
}
