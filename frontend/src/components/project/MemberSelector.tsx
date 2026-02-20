import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '../../api/todo';
import { hrApi } from '../../api/hr';
import { coreApi, CreateProjectMemberPayload } from '../../api/core';
import type { ProjectMember } from '../../types';
import type { Contact } from '../../types/hr';
import toast from 'react-hot-toast';

interface MemberSelectorProps {
  projectId: number;
  value: ProjectMember | null;
  onChange: (member: ProjectMember | null) => void;
  placeholder?: string;
  disabled?: boolean;
  membersFromProject?: ProjectMember[];
}

function contactDisplayName(c: Contact): string {
  const name = [c.last_name, c.first_name].filter(Boolean).join(' ').trim();
  return name || c.email || `Контакт #${c.id}`;
}

export default function MemberSelector({
  projectId,
  value,
  onChange,
  placeholder = 'Выберите ответственного',
  disabled = false,
  membersFromProject = [],
}: MemberSelectorProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => todoApi.getProject(projectId),
    enabled: projectId > 0,
  });
  const workspaceId = project?.workspace ?? 0;

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', workspaceId, 'SYSTEM'],
    queryFn: () => hrApi.getContacts({ workspace_id: workspaceId, super_group: 'SYSTEM' }),
    enabled: workspaceId > 0,
  });

  const { data: membersList = [], isLoading } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => coreApi.getProjectMembers(projectId),
    enabled: projectId > 0,
  });

  const members = membersList.length > 0 ? membersList : membersFromProject;
  const addedContactIds = new Set(
    members
      .map((m) => (m.contact && typeof m.contact === 'object' ? m.contact.id : null))
      .filter((id): id is number => id != null)
  );
  const addedUserIds = new Set(
    members
      .map((m) => (m.contact && typeof m.contact === 'object' ? m.contact.user : null))
      .filter((id): id is number => id != null)
  );
  const availableContacts = contacts.filter(
    (c) => !addedContactIds.has(c.id) && (c.user == null || !addedUserIds.has(c.user))
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectMemberPayload) => coreApi.createProjectMember(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      onChange(created);
      setAddDialogOpen(false);
      setNewName('');
      setNewRole('');
      setOpen(false);
      toast.success('Участник добавлен');
    },
    onError: (err: unknown) => {
      const res = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { detail?: string }; status?: number } }).response : undefined;
      const detail = res?.data?.detail;
      const status = res?.status;
      const data = res?.data;
      const firstField = data && typeof data === 'object' && !Array.isArray(data) && typeof detail !== 'string'
        ? Object.entries(data).filter(([k]) => k !== 'detail').map(([, v]) => (Array.isArray(v) ? v[0] : v)).find(Boolean)
        : null;
      const msg =
        (typeof detail === 'string' && detail) ||
        (status === 403 && 'Недостаточно прав: добавление участников доступно Director и Manager') ||
        (typeof firstField === 'string' && firstField) ||
        'Ошибка при добавлении участника';
      toast.error(msg);
    },
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectContact = (contact: Contact) => {
    createMutation.mutate({
      project: projectId,
      contact_id: contact.id,
      role: 'Участник',
    });
  };

  const handleAddMember = () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Введите имя');
      return;
    }
    createMutation.mutate({
      project: projectId,
      display_name: name,
      role: newRole.trim() || 'Участник',
    });
  };

  const isShadowValue = value?.contact && typeof value.contact === 'object' && value.contact.user == null;
  const avatarUrl = value?.avatar_url ?? (value?.contact && typeof value.contact === 'object' ? value.contact.avatar_url : null);
  const displayValue =
    value?.display_name ??
    (value?.contact && typeof value.contact === 'object' ? contactDisplayName(value.contact) : '?');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-imperial-surface text-left text-gray-900 dark:text-imperial-text focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
      >
        {value ? (
          <>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
                {(displayValue || '?').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate">{displayValue}</span>
            {isShadowValue && <span className="shrink-0" title="Теневой">👻</span>}
            {value.role && (
              <span className="text-xs text-gray-500 dark:text-imperial-muted truncate">({value.role})</span>
            )}
          </>
        ) : (
          <span className="text-gray-500 dark:text-imperial-muted">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-imperial-surface shadow-lg max-h-64 overflow-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-gray-500">Загрузка...</div>
          ) : (
            <>
              {availableContacts.map((contact) => {
                const isShadow = !contact.user;
                const name = contactDisplayName(contact);
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleSelectContact(contact)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-900 dark:text-imperial-text"
                  >
                    {contact.avatar_url ? (
                      <img src={contact.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate flex items-center gap-1">
                        {name}
                        {isShadow && <span title="Теневой">👻</span>}
                      </div>
                      {contact.email && (
                        <div className="text-xs text-gray-500 dark:text-imperial-muted truncate">{contact.email}</div>
                      )}
                    </div>
                  </button>
                );
              })}
              <div className="border-t border-gray-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setAddDialogOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-primary-600 dark:text-imperial-gold hover:bg-primary-50 dark:hover:bg-imperial-gold/10 font-medium"
                >
                  <span className="text-lg">+</span> Add Member
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {addDialogOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setAddDialogOpen(false)}
        >
          <div
            className="bg-white dark:bg-imperial-surface rounded-xl shadow-xl w-full max-w-sm m-4 p-6 border border-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-imperial-text mb-4">Добавить участника</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-imperial-muted mb-1">Имя *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Имя участника"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-imperial-surface text-gray-900 dark:text-imperial-text focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-imperial-muted mb-1">Роль</label>
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Напр. Разработчик"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-imperial-surface text-gray-900 dark:text-imperial-text focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setAddDialogOpen(false);
                  setNewName('');
                  setNewRole('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-imperial-muted bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAddMember}
                disabled={!newName.trim() || createMutation.isPending}
                className="px-4 py-2 bg-primary-600 dark:bg-imperial-gold text-white dark:text-imperial-bg rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
