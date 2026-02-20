import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Contact } from '../../types/hr';
import { isShadowContact } from '../../types/hr';
import { hrApi } from '../../api/hr';
import toast from 'react-hot-toast';

export interface WorkspaceMemberForGuarantor {
  id: number;
  user?: { id: number; username?: string; first_name?: string; last_name?: string };
  role?: string;
}

interface ContactListTableProps {
  contacts: Contact[];
  canSeeFinance: boolean;
  workspaceMembers: WorkspaceMemberForGuarantor[];
  onRowClick: (contact: Contact) => void;
  onNameClick?: (contact: Contact) => void;
  onInviteSent?: () => void;
}

function getDisplayName(c: Contact): string {
  const name = [c.last_name, c.first_name].filter(Boolean).join(' ').trim();
  return name || c.email || `Контакт #${c.id}`;
}

function getGuarantorDisplay(members: WorkspaceMemberForGuarantor[], guarantorId: number | null): string | null {
  if (!guarantorId) return null;
  const m = members.find((x) => x.user?.id === guarantorId);
  if (!m?.user) return null;
  const u = m.user;
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return name || u.username || `User ${u.id}`;
}

export default function ContactListTable({
  contacts,
  canSeeFinance,
  workspaceMembers,
  onRowClick,
  onNameClick,
  onInviteSent,
}: ContactListTableProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleInvite = async (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation();
    if (!contact.email || !isShadowContact(contact)) return;
    setInviteLoading(true);
    try {
      const { invite_url } = await hrApi.inviteContact(contact.id);
      setInviteUrl(invite_url);
      onInviteSent?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Ошибка при создании приглашения');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-200">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 py-3 font-semibold text-imperial-gold">Персона</th>
              <th className="px-4 py-3 font-semibold text-imperial-muted">Статус</th>
              <th className="px-4 py-3 font-semibold text-imperial-muted">Группа</th>
              <th className="px-4 py-3 font-semibold text-imperial-muted">Поручитель</th>
              <th className="px-4 py-3 font-semibold text-imperial-muted">Ставка</th>
              <th className="px-4 py-3 font-semibold text-imperial-muted w-20">Действия</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-imperial-muted">
                  Нет контактов
                </td>
              </tr>
            ) : (
              contacts.map((contact) => {
                const isShadow = isShadowContact(contact);
                const guarantorName = getGuarantorDisplay(workspaceMembers, contact.guarantor);
                const rateDisplay =
                  contact.tariff_rate != null && contact.tariff_rate !== ''
                    ? `${Number(contact.tariff_rate)} ${contact.currency || 'RUB'}`
                    : '—';

                return (
                  <tr
                    key={contact.id}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${isShadow ? 'opacity-90' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {contact.avatar_url ? (
                          <img
                            src={contact.avatar_url}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover border border-white/10 shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-imperial-gold/20 border border-imperial-gold/30 flex items-center justify-center text-imperial-gold font-bold shrink-0">
                            {getDisplayName(contact)[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {onNameClick ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNameClick(contact);
                                }}
                                className="font-medium text-slate-100 truncate hover:text-imperial-gold transition-colors text-left"
                              >
                                {getDisplayName(contact)}
                              </button>
                            ) : (
                              <Link
                                to={`/hr/contacts/${contact.id}`}
                                className="font-medium text-slate-100 truncate hover:text-imperial-gold transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {getDisplayName(contact)}
                              </Link>
                            )}
                            {isShadow && (
                              <span title="Теневой контакт" className="shrink-0" aria-hidden>
                                👻
                              </span>
                            )}
                            {!isShadow && (
                              <span
                                className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
                                title="Активный пользователь"
                              />
                            )}
                          </div>
                          {contact.email && (
                            <p className="text-xs text-imperial-muted truncate">{contact.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isShadow
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                      >
                        {isShadow ? 'Shadow' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-lg bg-white/10 text-imperial-muted text-xs">
                        {contact.group || contact.super_group === 'SYSTEM' ? 'Staff' : 'Partner'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isShadow && guarantorName ? (
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-imperial-muted text-xs font-medium shrink-0">
                            {guarantorName[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="text-sm text-imperial-muted">{guarantorName}</span>
                        </div>
                      ) : (
                        <span className="text-imperial-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canSeeFinance ? (
                        <span className="text-imperial-gold font-medium">{rateDisplay}</span>
                      ) : (
                        <span className="text-imperial-muted" title="Нет прав на просмотр">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onRowClick(contact)}
                          className="p-2 rounded-lg text-imperial-muted hover:text-white hover:bg-white/10 transition-colors"
                          title="Редактировать"
                        >
                          ✏️
                        </button>
                        {isShadow && contact.email && (
                          <button
                            type="button"
                            onClick={(e) => handleInvite(e, contact)}
                            disabled={inviteLoading}
                            className="p-2 rounded-lg text-imperial-muted hover:text-imperial-gold hover:bg-white/10 transition-colors disabled:opacity-50"
                            title="Отправить приглашение (48ч)"
                          >
                            ✉️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {inviteUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setInviteUrl(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-imperial-surface border border-white/10 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-2">Ссылка на приглашение</h3>
            <p className="text-sm text-imperial-muted mb-3">Срок действия 48 часов. Скопируйте и отправьте контакту.</p>
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteUrl(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  toast.success('Ссылка скопирована');
                }}
                className="px-4 py-2 rounded-lg bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500"
              >
                Копировать
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
