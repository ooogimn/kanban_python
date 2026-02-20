import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeApi, type Category } from '../../api/finance';
import type { Workspace } from '../../types';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 min-h-[44px] text-imperial-text placeholder-slate-500 focus:outline-none focus:border-imperial-gold/80 transition touch-manipulation';

const selectClass =
  'w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 min-h-[44px] text-imperial-text focus:outline-none focus:border-imperial-gold/80 [color-scheme:dark] touch-manipulation';

const selectOptionStyle: React.CSSProperties = {
  color: '#0f172a',
  backgroundColor: '#f8fafc',
};

const CATEGORY_COLORS = [
  '#F59E0B',
  '#6366F1',
  '#EC4899',
  '#10B981',
  '#0EA5E9',
  '#14B8A6',
  '#E11D48',
  '#8B5CF6',
  '#64748B',
];

type TreeNode = Category & { children: TreeNode[] };

function buildTree(categories: Category[]): TreeNode[] {
  const map = new Map<number | null, TreeNode>();
  categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: TreeNode[] = [];
  categories.forEach((c) => {
    const node = map.get(c.id)!;
    const parentId = c.parent ?? null;
    if (parentId === null) {
      roots.push(node);
    } else {
      const parent = map.get(parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  });
  roots.sort((a, b) => a.name.localeCompare(b.name));
  roots.forEach((r) => r.children.sort((a, b) => a.name.localeCompare(b.name)));
  return roots;
}

export function CategoryManagerModal({
  isOpen,
  onClose,
  workspaces,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
}) {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<'expense' | 'income'>('expense');
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addParentId, setAddParentId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    pnl_group: 'other',
    workspace: '' as string,
    parent: null as number | null,
    color: CATEGORY_COLORS[0],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['finance-categories'],
    queryFn: () => financeApi.getCategories(),
  });

  const filtered = useMemo(() => {
    return categories.filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (workspaceFilter) {
        const ws = workspaceFilter === 'null' ? null : Number(workspaceFilter);
        if (c.workspace !== ws) return false;
      }
      return true;
    });
  }, [categories, typeFilter, workspaceFilter]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  const defaultExpandedIds = useMemo(() => {
    const ids = new Set<number>();
    const collect = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        if (n.children.length > 0) {
          ids.add(n.id);
          collect(n.children);
        }
      });
    };
    collect(tree);
    return ids;
  }, [tree]);

  const [expandedIds, setExpandedIds] = useState<Set<number>>(defaultExpandedIds);

  useEffect(() => {
    setExpandedIds(defaultExpandedIds);
  }, [defaultExpandedIds]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: financeApi.createCategory,
    onSuccess: () => {
      toast.success('Категория создана');
      queryClient.invalidateQueries({ queryKey: ['finance-categories'] });
      setForm({ name: '', type: 'expense', pnl_group: 'other', workspace: '', parent: null, color: CATEGORY_COLORS[0] });
      setAddParentId(null);
    },
    onError: (err: { response?: { data?: { name?: string[] } } }) => {
      const msg = err?.response?.data?.name?.[0] ?? 'Не удалось создать категорию';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof financeApi.updateCategory>[1] }) =>
      financeApi.updateCategory(id, data),
    onSuccess: () => {
      toast.success('Категория обновлена');
      queryClient.invalidateQueries({ queryKey: ['finance-categories'] });
      setEditingId(null);
    },
    onError: () => toast.error('Не удалось обновить категорию'),
  });

  const deleteMutation = useMutation({
    mutationFn: financeApi.deleteCategory,
    onSuccess: () => {
      toast.success('Категория удалена');
      queryClient.invalidateQueries({ queryKey: ['finance-categories'] });
    },
    onError: () => toast.error('Не удалось удалить категорию (возможно, используется в операциях)'),
  });

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error('Введите название');
      return;
    }
    createMutation.mutate({
      name: form.name.trim(),
      type: form.type,
      pnl_group: form.pnl_group,
      workspace: form.workspace ? Number(form.workspace) : null,
      parent: addParentId ?? form.parent,
      color: form.color,
    });
  };

  const handleUpdate = (id: number, patch: { name?: string; color?: string }) => {
    updateMutation.mutate({ id, data: patch });
  };

  const handleDelete = (node: TreeNode) => {
    if (node.children?.length) {
      toast.error('Сначала удалите подкатегории');
      return;
    }
    if (!window.confirm(`Удалить категорию «${node.name}»?`)) return;
    deleteMutation.mutate(node.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden md:rounded-3xl rounded-t-3xl bg-imperial-surface border border-white/10 border-b-0 md:border-b flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0 min-h-[44px]">
          <h3 className="text-xl font-semibold text-imperial-text">⚙️ Настройки категорий</h3>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-slate-400 hover:text-white touch-manipulation">
            ✕
          </button>
        </div>

        <div className="p-4 border-b border-white/10 flex flex-wrap gap-3 shrink-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'expense' | 'income')}
            className={`${selectClass} text-sm w-auto`}
          >
            <option value="expense" style={selectOptionStyle}>
              Расходы
            </option>
            <option value="income" style={selectOptionStyle}>
              Доходы
            </option>
          </select>
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            className={`${selectClass} text-sm w-auto`}
          >
            <option value="" style={selectOptionStyle}>
              Все пространства
            </option>
            <option value="null" style={selectOptionStyle}>
              Системные
            </option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={String(ws.id)} style={selectOptionStyle}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-xs uppercase text-slate-400">
              {addParentId ? 'Новая подкатегория' : 'Новая корневая категория'}
            </p>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className={inputClass}
              placeholder="Название"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as 'income' | 'expense' }))}
                className={selectClass}
              >
                <option value="expense" style={selectOptionStyle}>
                  Расход
                </option>
                <option value="income" style={selectOptionStyle}>
                  Доход
                </option>
              </select>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Цвет:</span>
                <div className="flex gap-1 flex-wrap">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, color }))}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        form.color === color ? 'border-imperial-gold scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {!addParentId && (
              <select
                value={form.workspace}
                onChange={(e) => setForm((prev) => ({ ...prev, workspace: e.target.value }))}
                className={selectClass}
              >
                <option value="" style={selectOptionStyle}>
                  Системная категория
                </option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={String(ws.id)} style={selectOptionStyle}>
                    {ws.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="px-4 py-2 rounded-xl bg-imperial-gold text-black font-semibold disabled:opacity-50"
              >
                {createMutation.isPending ? 'Создание…' : 'Создать'}
              </button>
              {addParentId && (
                <button
                  type="button"
                  onClick={() => setAddParentId(null)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-slate-300"
                >
                  Отмена
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-400 mb-3">Дерево категорий</p>
            <CategoryTree
              nodes={tree}
              level={0}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              editingId={editingId}
              setEditingId={setEditingId}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAddChild={(parentId) => {
                setAddParentId(parentId);
                const parent = categories.find((c) => c.id === parentId);
                setForm((prev) => ({
                  ...prev,
                  parent: parentId,
                  workspace: parent?.workspace ? String(parent.workspace) : prev.workspace,
                  type: (parent?.type ?? 'expense') as 'income' | 'expense',
                }));
              }}
              updatePending={updateMutation.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function EditCategoryRow({
  node,
  onSave,
  onCancel,
  disabled,
}: {
  node: TreeNode;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [name, setName] = useState(node.name);
  const [color, setColor] = useState(node.color || CATEGORY_COLORS[0]);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(name.trim(), color);
          if (e.key === 'Escape') onCancel();
        }}
        className={inputClass}
        autoFocus
      />
      <div className="flex gap-1">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`w-5 h-5 rounded-full border-2 ${color === c ? 'border-imperial-gold' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSave(name.trim(), color)}
        disabled={disabled || !name.trim()}
        className="px-3 py-1 rounded-lg bg-imperial-gold text-black text-sm font-medium disabled:opacity-50"
      >
        ✓
      </button>
      <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white text-sm">
        ✕
      </button>
    </div>
  );
}

function CategoryTree({
  nodes,
  level,
  expandedIds,
  onToggleExpand,
  editingId,
  setEditingId,
  onUpdate,
  onDelete,
  onAddChild,
  updatePending,
}: {
  nodes: TreeNode[];
  level: number;
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  onUpdate: (id: number, patch: { name?: string; color?: string }) => void;
  onDelete: (node: TreeNode) => void;
  onAddChild: (parentId: number) => void;
  updatePending: boolean;
}) {
  return (
    <ul className="space-y-1" style={{ paddingLeft: level * 16 }}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedIds.has(node.id);

        return (
          <li key={node.id} className="rounded-xl border border-white/5 bg-white/5">
            <div className="p-3">
              {editingId === node.id ? (
                <EditCategoryRow
                  node={node}
                  onSave={(name, color) => {
                    if (name) onUpdate(node.id, { name, color });
                  }}
                  onCancel={() => setEditingId(null)}
                  disabled={updatePending}
                />
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => onToggleExpand(node.id)}
                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-imperial-gold transition"
                        aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                      >
                        <span
                          className={`inline-block transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        >
                          ▶
                        </span>
                      </button>
                    ) : (
                      <span className="w-6 shrink-0" />
                    )}
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: node.color || '#cccccc' }}
                    />
                    <span className="text-imperial-text truncate">{node.name}</span>
                    {node.workspace && (
                      <span className="text-xs text-slate-500 shrink-0">({node.workspace})</span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingId(node.id)}
                      className="text-slate-400 hover:text-imperial-gold text-xs px-2 py-1"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddChild(node.id)}
                      className="text-slate-400 hover:text-emerald-400 text-xs px-2 py-1"
                    >
                      + Подкатегория
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(node)}
                      className="text-slate-400 hover:text-red-400 text-xs px-2 py-1"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </div>
            {hasChildren && isExpanded && (
              <div className="pl-3 pb-2">
                <CategoryTree
                  nodes={node.children}
                  level={level + 1}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  updatePending={updatePending}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
