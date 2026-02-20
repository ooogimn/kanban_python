import { useCallback, useMemo, useState, useEffect } from 'react';
import { useParams, useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mindmapsApi, type MindMapDto } from '../api/mindmaps';
import MindMapEditor from '../components/mindmaps/MindMapEditor';
import toast from 'react-hot-toast';
import type { Node, Edge } from '@xyflow/react';

function ensureNodeStyle(nodes: unknown[]): Node[] {
  const style = {
    background: 'rgb(30 41 59)',
    border: '1px solid rgb(71 85 105)',
    color: 'white',
    borderRadius: 8,
    padding: '8px 12px',
  };
  return (nodes as Node[]).map((n) => ({
    ...n,
    type: (n as Node).type ?? 'default',
    data: n.data ?? { label: 'Узел' },
    style: n.style ?? style,
  }));
}

function ensureEdges(edges: unknown[]): Edge[] {
  return (edges ?? []) as Edge[];
}

export default function MindMapEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workitemId = searchParams.get('workitem_id') ? Number(searchParams.get('workitem_id')) : undefined;
  const projectId = searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined;
  /** Режим «новая карта»: либо путь /mindmaps/new (тогда id нет), либо id === 'new' при маршруте mindmaps/:id */
  const isNew = id === 'new' || location.pathname === '/mindmaps/new';

  const { data: map, isLoading } = useQuery({
    queryKey: ['mindmap', id],
    queryFn: () => mindmapsApi.getOne(Number(id!)),
    enabled: !isNew && !!id && id !== 'new',
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<MindMapDto>) => mindmapsApi.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['mindmaps'] });
      toast.success('Карта создана');
      navigate(`/mindmaps/${created.id}`, { replace: true });
    },
    onError: () => toast.error('Ошибка создания карты'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id: mapId, nodes, edges }: { id: number; nodes: Node[]; edges: Edge[] }) =>
      mindmapsApi.update(mapId, { nodes: nodes as unknown[], edges: edges as unknown[] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mindmap', id] });
      queryClient.invalidateQueries({ queryKey: ['mindmaps'] });
      toast.success('Карта сохранена');
    },
    onError: () => toast.error('Ошибка сохранения'),
  });

  const updateTitleMutation = useMutation({
    mutationFn: ({ id: mapId, title: newTitle }: { id: number; title: string }) =>
      mindmapsApi.update(mapId, { title: newTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mindmap', id] });
      queryClient.invalidateQueries({ queryKey: ['mindmaps'] });
    },
    onError: () => toast.error('Ошибка сохранения названия'),
  });

  const [title, setTitle] = useState(map?.title ?? 'Новая карта');
  useEffect(() => {
    if (map?.title != null) setTitle(map.title);
  }, [map?.title]);

  const handleSave = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (isNew) {
        createMutation.mutate({
          title: title.trim() || 'Новая карта',
          nodes: nodes as unknown[],
          edges: edges as unknown[],
          is_personal: !(projectId ?? workitemId),
          related_workitem: workitemId ?? null,
          project: projectId ?? null,
        });
        return;
      }
      if (id && id !== 'new') {
        updateMutation.mutate({ id: Number(id), nodes, edges });
      }
    },
    [isNew, id, workitemId, projectId, title, createMutation, updateMutation]
  );

  const initialNodes = useMemo(() => {
    if (isNew) {
      const style = { background: 'rgb(30 41 59)', border: '1px solid rgb(71 85 105)', color: 'white', borderRadius: 8, padding: '8px 12px' };
      const rootW = 140;
      const rootH = 44;
      return [{
        id: '1',
        type: 'default',
        position: { x: 250, y: 150 },
        data: {
          label: 'Корень',
          width: rootW,
          height: rootH,
          labelFontSize: 10,
        },
        width: rootW,
        height: rootH,
        style,
      }];
    }
    if (map?.nodes?.length) return ensureNodeStyle(map.nodes);
    return [];
  }, [isNew, map?.nodes]);

  const initialEdges = useMemo(() => {
    if (map?.edges?.length) return ensureEdges(map.edges);
    return [];
  }, [map?.edges]);

  if (!isNew && (!id || id === 'new')) {
    return (
      <div className="p-6">
        <Link to="/mindmaps" className="text-imperial-gold hover:underline">← К списку карт</Link>
        <p className="mt-4 text-slate-500">Неверный идентификатор карты.</p>
      </div>
    );
  }

  if (!isNew && isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        Загрузка карты…
      </div>
    );
  }

  if (!isNew && !map) {
    return (
      <div className="p-6">
        <Link to="/mindmaps" className="text-imperial-gold hover:underline">← К списку карт</Link>
        <p className="mt-4 text-slate-500">Карта не найдена.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-slate-800 border-b border-slate-600">
        <Link to={workitemId ? `/tasks/${workitemId}` : '/mindmaps'} className="text-slate-300 hover:text-white text-sm">
          ← {workitemId ? 'К задаче' : 'К списку карт'}
        </Link>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (!isNew && id && id !== 'new' && title.trim() !== map?.title) {
              updateTitleMutation.mutate({ id: Number(id), title: title.trim() || 'Без названия' });
            }
          }}
          placeholder="Название карты"
          className="text-lg font-semibold text-white bg-transparent border border-transparent hover:border-slate-500 rounded px-1 py-0.5 min-w-0 max-w-[50vw] truncate focus:outline-none focus:border-cyan-500"
        />
        <span className="w-20" />
      </div>
      <div className="flex-1 min-h-0">
        <MindMapEditor
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onSave={handleSave}
          saveLoading={createMutation.isPending || updateMutation.isPending}
          workitemId={workitemId}
          projectId={projectId}
        />
      </div>
    </div>
  );
}
