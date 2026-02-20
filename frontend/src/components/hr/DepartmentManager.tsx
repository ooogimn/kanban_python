/**
 * Управление структурой отделов (Organization Chart).
 * Древовидный список отделов с возможностью CRUD.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { hrApi } from '../../api/hr';
import { workspaceApi } from '../../api/workspace';
import type { Department, EmployeeProfile } from '../../types/hr';

interface DepartmentManagerProps {
  workspaceId: number;
  employees: EmployeeProfile[];
  departments: Department[];
}

export default function DepartmentManager({
  workspaceId,
  employees,
  departments,
}: DepartmentManagerProps) {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addParentId, setAddParentId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formHeadId, setFormHeadId] = useState<number | ''>('');

  const createMutation = useMutation({
    mutationFn: (data: { name: string; parent?: number | null; head?: number | null; workspace: number }) =>
      hrApi.createDepartment({ ...data, workspace: workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments', workspaceId] });
      setAddParentId(null);
      setFormName('');
      setFormHeadId('');
      toast.success('Отдел создан');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Department> }) =>
      hrApi.updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments', workspaceId] });
      setEditingId(null);
      toast.success('Отдел обновлён');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrApi.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments', workspaceId] });
      toast.success('Отдел удалён');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Ошибка');
    },
  });

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getWorkspaceMembers(workspaceId),
    enabled: workspaceId > 0,
  });
  const members = Array.isArray(membersData) ? membersData : [];

  const rootDepts = departments.filter((d) => !d.parent);
  const getChildren = (parentId: number) => departments.filter((d) => d.parent === parentId);
  const getEmployeeCount = (deptId: number) => employees.filter((e) => e.department === deptId).length;
  const getHeadName = (headId: number | null) => {
    if (!headId) return '—';
    const member = members.find((m: { id: number }) => m.id === headId);
    if (!member?.user) return `#${headId}`;
    const u = member.user;
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || `#${headId}`;
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = (parentId: number | null) => {
    if (!formName.trim()) return;
    createMutation.mutate({
      name: formName.trim(),
      parent: parentId,
      head: formHeadId === '' ? null : (formHeadId as number),
      workspace: workspaceId,
    });
  };

  const handleUpdate = (id: number) => {
    if (!formName.trim()) return;
    updateMutation.mutate({ id, data: { name: formName.trim(), head: formHeadId === '' ? null : (formHeadId as number) } });
  };

  const renderDept = (dept: Department, level: number) => {
    const children = getChildren(dept.id);
    const count = getEmployeeCount(dept.id);
    const isExpanded = expandedIds.has(dept.id);
    const isEditing = editingId === dept.id;
    const isAdding = addParentId === dept.id;

    return (
      <div key={dept.id} className="ml-4">
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-white/5 group ${
            level === 0 ? 'font-medium' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleExpand(dept.id)}
              className="p-0.5 rounded text-imperial-muted hover:text-white"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <Building2 className="w-4 h-4 text-imperial-gold shrink-0" />
          {isEditing ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 text-sm"
                autoFocus
              />
              <select
                value={formHeadId === '' ? '' : formHeadId}
                onChange={(e) => setFormHeadId(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 text-sm"
              >
                <option value="">Без руководителя</option>
                {members.map((m: { id: number; user?: { first_name?: string; last_name?: string; username?: string } }) => (
                  <option key={m.id} value={m.id}>
                    {[m.user?.first_name, m.user?.last_name].filter(Boolean).join(' ') || m.user?.username || `#${m.id}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleUpdate(dept.id)}
                className="px-2 py-1 rounded bg-imperial-gold text-imperial-bg text-sm"
              >
                Сохранить
              </button>
              <button type="button" onClick={() => setEditingId(null)} className="px-2 py-1 rounded bg-white/10 text-sm">
                Отмена
              </button>
            </div>
          ) : (
            <>
              <span className="text-white flex-1">{dept.name}</span>
              <span className="text-imperial-muted text-sm">{getHeadName(dept.head)}</span>
              <span className="text-imperial-muted text-sm">({count})</span>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(dept.id);
                    setFormName(dept.name);
                    setFormHeadId(dept.head ?? '');
                  }}
                  className="p-1.5 rounded text-imperial-muted hover:text-white hover:bg-white/10"
                  title="Редактировать"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAddParentId(addParentId === dept.id ? null : dept.id)}
                  className="p-1.5 rounded text-imperial-muted hover:text-imperial-gold hover:bg-white/10"
                  title="Добавить подотдел"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => (children.length > 0 ? toast.error('Сначала удалите подотделы') : deleteMutation.mutate(dept.id))}
                  className="p-1.5 rounded text-imperial-muted hover:text-red-400 hover:bg-white/10"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {isAdding && (
          <div className="ml-8 py-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="Название отдела"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="flex-1 max-w-xs rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 text-sm"
            />
            <select
              value={formHeadId === '' ? '' : formHeadId}
              onChange={(e) => setFormHeadId(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 text-sm"
            >
              <option value="">Без руководителя</option>
              {members.map((m: { id: number; user?: { first_name?: string; last_name?: string; username?: string } }) => (
                <option key={m.id} value={m.id}>
                  {[m.user?.first_name, m.user?.last_name].filter(Boolean).join(' ') || m.user?.username || `#${m.id}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAdd(dept.id)}
              className="px-3 py-1 rounded bg-imperial-gold text-imperial-bg text-sm"
            >
              Создать
            </button>
            <button type="button" onClick={() => { setAddParentId(null); setFormName(''); setFormHeadId(''); }} className="text-imperial-muted text-sm">
              Отмена
            </button>
          </div>
        )}

        {isExpanded && children.map((c) => renderDept(c, level + 1))}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-white/10 bg-imperial-surface/60 overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-semibold text-white">Структура отделов</h3>
        <button
          type="button"
          onClick={() => setAddParentId(addParentId === 0 ? null : 0)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-imperial-gold/20 text-imperial-gold hover:bg-imperial-gold/30 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Добавить отдел
        </button>
      </div>
      <div className="p-4">
        {addParentId === 0 && (
          <div className="mb-4 flex items-center gap-2">
            <input
              type="text"
              placeholder="Название отдела"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="flex-1 max-w-xs rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 text-sm"
            />
            <select
              value={formHeadId === '' ? '' : formHeadId}
              onChange={(e) => setFormHeadId(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 text-sm"
            >
              <option value="">Без руководителя</option>
              {members.map((m: { id: number; user?: { first_name?: string; last_name?: string; username?: string } }) => (
                <option key={m.id} value={m.id}>
                  {[m.user?.first_name, m.user?.last_name].filter(Boolean).join(' ') || m.user?.username || `#${m.id}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAdd(null)}
              className="px-3 py-1 rounded bg-imperial-gold text-imperial-bg text-sm"
            >
              Создать
            </button>
            <button type="button" onClick={() => { setAddParentId(null); setFormName(''); setFormHeadId(''); }} className="text-imperial-muted text-sm">
              Отмена
            </button>
          </div>
        )}

        {rootDepts.length === 0 ? (
          <p className="text-imperial-muted py-4">Нет отделов. Создайте первый отдел.</p>
        ) : (
          rootDepts.map((d) => renderDept(d, 0))
        )}

        {employees.filter((e) => !e.department).length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-imperial-muted text-sm">
              Без отдела: {employees.filter((e) => !e.department).length} чел.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
