import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  addEdge,
  applyNodeChanges,
  Background,
  Controls,
  Panel,
  type Connection,
  type Node,
  type Edge,
  type ColorMode,
  type NodeChange,
} from '@xyflow/react';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import '@xyflow/react/dist/style.css';
import CyberNode from './CyberNode';
import CyberEdge from './CyberEdge';
import NodeSettingsSidebar from './NodeSettingsSidebar';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './nodeConfig';

export type MindMapTheme = 'dark' | 'light';

/** Возвращает множество id всех потомков узла (рекурсивно по рёбрам source → target). */
function getDescendantIds(edges: Edge[], nodeId: string): Set<string> {
  const childrenMap = new Map<string, string[]>();
  for (const e of edges) {
    const src = String(e.source);
    if (!childrenMap.has(src)) childrenMap.set(src, []);
    childrenMap.get(src)!.push(String(e.target));
  }
  const result = new Set<string>();
  const stack = [...(childrenMap.get(nodeId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    result.add(id);
    stack.push(...(childrenMap.get(id) ?? []));
  }
  return result;
}

const controlsStyleDark = `
  .mindmap-editor .react-flow__attribution {
    display: none !important;
  }
  .mindmap-editor .react-flow__controls {
    background: rgb(30 41 59) !important;
    border: 1px solid rgb(71 85 105) !important;
    border-radius: 8px !important;
  }
  .mindmap-editor .react-flow__controls button {
    background: rgb(51 65 85) !important;
    border-color: rgb(71 85 105) !important;
    color: rgb(226 232 240) !important;
    fill: rgb(226 232 240) !important;
  }
  .mindmap-editor .react-flow__controls button:hover {
    background: rgb(71 85 105) !important;
    color: white !important;
    fill: white !important;
  }
`;

const controlsStyleLight = `
  .mindmap-editor .react-flow__attribution {
    display: none !important;
  }
  .mindmap-editor .react-flow__controls {
    background: rgb(241 245 249) !important;
    border: 1px solid rgb(203 213 225) !important;
    border-radius: 8px !important;
  }
  .mindmap-editor .react-flow__controls button {
    background: rgb(226 232 240) !important;
    border-color: rgb(203 213 225) !important;
    color: rgb(51 65 85) !important;
    fill: rgb(51 65 85) !important;
  }
  .mindmap-editor .react-flow__controls button:hover {
    background: rgb(203 213 225) !important;
    color: rgb(15 23 42) !important;
    fill: rgb(15 23 42) !important;
  }
`;

const defaultNodeStyle = {
  background: 'rgb(30 41 59)',
  border: '1px solid rgb(71 85 105)',
  color: 'white',
  borderRadius: 8,
  padding: '8px 12px',
};

interface MindMapEditorProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onSave: (nodes: Node[], edges: Edge[]) => void;
  saveLoading?: boolean;
  workitemId?: number;
  projectId?: number;
}

/** Панель инструментов — должна рендериться внутри ReactFlow, чтобы useReactFlow() работал. */
function FlowToolbar({
  onSave,
  saveLoading,
  workitemId,
  theme,
  onThemeChange,
}: {
  onSave: (nodes: Node[], edges: Edge[]) => void;
  saveLoading?: boolean;
  workitemId?: number;
  theme: MindMapTheme;
  onThemeChange: (theme: MindMapTheme) => void;
}) {
  const { getNodes, getEdges, addNodes, fitView } = useReactFlow();
  const domNode = useStore((s) => s.domNode);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    onSave(getNodes(), getEdges());
  }, [onSave, getNodes, getEdges]);

  const handleAddNode = useCallback(() => {
    const nodes = getNodes();
    const center = nodes.length > 0
      ? { x: 250 + Math.random() * 100, y: 150 + Math.random() * 100 }
      : { x: 250, y: 150 };
    addNodes({
      id: `node-${Date.now()}`,
      type: 'default',
      position: center,
      data: { label: 'Новый узел', width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
      style: defaultNodeStyle,
    });
  }, [addNodes, getNodes]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const exportOptions = { pixelRatio: 2, cacheBust: true };

  const handleExportPng = useCallback(() => {
    if (!domNode) return;
    setExporting('png');
    toPng(domNode, exportOptions)
      .then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `mindmap-${Date.now()}.png`;
        a.click();
      })
      .catch((err) => console.error('Export PNG failed', err))
      .finally(() => setExporting(null));
  }, [domNode]);

  const handleExportJpg = useCallback(() => {
    if (!domNode) return;
    setExporting('jpg');
    toJpeg(domNode, { ...exportOptions, quality: 0.95 })
      .then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `mindmap-${Date.now()}.jpg`;
        a.click();
      })
      .catch((err) => console.error('Export JPG failed', err))
      .finally(() => setExporting(null));
  }, [domNode]);

  const handleExportPdf = useCallback(() => {
    if (!domNode) return;
    setExporting('pdf');
    toPng(domNode, exportOptions)
      .then((dataUrl) => {
        const img = new Image();
        img.onload = () => {
          const pdf = new jsPDF({
            orientation: img.width > img.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [img.width, img.height],
          });
          pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
          pdf.save(`mindmap-${Date.now()}.pdf`);
          setExporting(null);
        };
        img.onerror = () => setExporting(null);
        img.src = dataUrl;
      })
      .catch((err) => {
        console.error('Export PDF failed', err);
        setExporting(null);
      });
  }, [domNode]);

  const isLight = theme === 'light';
  const panelClass = isLight
    ? 'bg-slate-100/95 border-slate-300 text-slate-800'
    : 'bg-slate-800/95 border-slate-600 text-slate-100';
  const btnSecondaryClass = isLight
    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'
    : 'bg-slate-600 hover:bg-slate-500 text-white border-slate-500';

  return (
    <Panel position="top-left" className="flex flex-col gap-1">
      <div className={`flex flex-wrap gap-1 p-1 rounded-md border shadow ${panelClass}`}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveLoading}
          className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50"
        >
          {saveLoading ? '…' : 'Сохранить'}
        </button>
        <button
          type="button"
          onClick={handleAddNode}
          className={`px-1.5 py-0.5 rounded text-xs font-medium border ${btnSecondaryClass}`}
        >
          Добавить узел
        </button>
        <button
          type="button"
          onClick={handleFitView}
          className={`px-1.5 py-0.5 rounded text-xs font-medium border ${btnSecondaryClass}`}
        >
          Авто-расстановка
        </button>

        <span
          className="text-[10px] self-center opacity-70 max-w-[140px] truncate"
          title="Выделение: Ctrl+клик или рамка (Shift). Копировать: Ctrl+C, вставить: Ctrl+V. При перетаскивании узла двигается вся дочерняя ветка."
        >
          Ctrl+C / Ctrl+V
        </span>

        <div className="w-px self-stretch bg-slate-400/50 mx-0.5" aria-hidden />

        <select
          value={theme}
          onChange={(e) => onThemeChange(e.target.value as MindMapTheme)}
          className={`px-1.5 py-0.5 rounded text-xs font-medium border cursor-pointer ${btnSecondaryClass}`}
          title="Тема"
        >
          <option value="dark">Тёмная</option>
          <option value="light">Светлая</option>
        </select>

        <div className="w-px self-stretch bg-slate-400/50 mx-0.5" aria-hidden />

        <span className="text-[10px] self-center opacity-80">Скачать:</span>
        <button
          type="button"
          onClick={handleExportPng}
          disabled={!domNode || !!exporting}
          className={`px-1.5 py-0.5 rounded text-xs font-medium border ${btnSecondaryClass} disabled:opacity-50`}
          title="Скачать PNG"
        >
          {exporting === 'png' ? '…' : 'PNG'}
        </button>
        <button
          type="button"
          onClick={handleExportJpg}
          disabled={!domNode || !!exporting}
          className={`px-1.5 py-0.5 rounded text-xs font-medium border ${btnSecondaryClass} disabled:opacity-50`}
          title="Скачать JPG"
        >
          {exporting === 'jpg' ? '…' : 'JPG'}
        </button>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={!domNode || !!exporting}
          className={`px-1.5 py-0.5 rounded text-xs font-medium border ${btnSecondaryClass} disabled:opacity-50`}
          title="Скачать PDF"
        >
          {exporting === 'pdf' ? '…' : 'PDF'}
        </button>

        {workitemId && (
          <>
            <div className="w-px self-stretch bg-slate-400/50 mx-0.5" aria-hidden />
            <Link
              to={`/tasks/${workitemId}`}
              className={`px-1.5 py-0.5 rounded text-xs font-medium border ${btnSecondaryClass}`}
            >
              Назад к задаче
            </Link>
          </>
        )}
      </div>
    </Panel>
  );
}

/** Панель управления (zoom, fit view) — кнопка Fit View переводит холст в полноэкранный режим. */
function MindMapControls({
  containerRef,
  className,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  className: string;
}) {
  const { fitView } = useReactFlow();
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
      });
    } else {
      document.exitFullscreen();
    }
  }, [containerRef, fitView]);
  return <Controls className={className} onFitView={handleFitView} />;
}

function EditorInner({
  initialNodes,
  initialEdges,
  onSave,
  saveLoading,
  workitemId,
}: Omit<MindMapEditorProps, 'projectId'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { getNodes, getEdges } = useReactFlow();
  const [theme, setTheme] = useState<MindMapTheme>('dark');

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  /** Актуальные nodes/edges для копирования (обновляются в рендере и в updater при изменении узлов). */
  const latestNodesRef = useRef<Node[]>(nodes);
  const latestEdgesRef = useRef<Edge[]>(edges);
  latestNodesRef.current = nodes;
  latestEdgesRef.current = edges;

  /** При перетаскивании узла сдвигаем на тот же вектор всех его потомков, если у узла data.dragWithChildren !== false. */
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      setNodes((currentNodes) => {
        let next = applyNodeChanges(changes, currentNodes);
        for (const ch of changes) {
          if (ch.type !== 'position' || ch.position == null) continue;
          const oldNode = currentNodes.find((n) => n.id === ch.id);
          if (!oldNode) continue;
          const dragWithChildren = (oldNode.data as { dragWithChildren?: boolean })?.dragWithChildren !== false;
          if (!dragWithChildren) continue;
          const newPos = ch.position;
          const dx = newPos.x - oldNode.position.x;
          const dy = newPos.y - oldNode.position.y;
          if (dx === 0 && dy === 0) continue;
          const descendantIds = getDescendantIds(edges, ch.id);
          next = next.map((n) =>
            descendantIds.has(n.id)
              ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
              : n
          );
        }
        latestNodesRef.current = next;
        return next;
      });
    },
    [setNodes, edges]
  );

  /** Буфер для копирования/вставки: выделенные узлы и рёбра между ними */
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      const target = document.activeElement as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (target?.getAttribute('contenteditable') === 'true') return;

      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        e.stopPropagation();
        const doCopy = () => {
          const currentNodes = latestNodesRef.current ?? getNodes();
          const currentEdges = latestEdgesRef.current ?? getEdges();
          const selected = currentNodes.filter((n) => n.selected);
          if (selected.length === 0) return;
          const selectedIds = new Set(selected.map((n) => n.id));
          const internalEdges = currentEdges.filter(
            (edge) => selectedIds.has(String(edge.source)) && selectedIds.has(String(edge.target))
          );
          clipboardRef.current = {
            nodes: selected.map((n) => ({ ...n })),
            edges: internalEdges.map((edge) => ({ ...edge })),
          };
        };
        doCopy();
        requestAnimationFrame(() => {
          doCopy();
        });
      } else if (e.key.toLowerCase() === 'v') {
        const clip = clipboardRef.current;
        if (!clip || clip.nodes.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        const idMap = new Map<string, string>();
        const ts = Date.now();
        clip.nodes.forEach((n, i) => idMap.set(n.id, `node-${ts}-${i}`));
        const newNodes: Node[] = clip.nodes.map((n) => ({
          ...n,
          id: idMap.get(n.id)!,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
          selected: true,
        }));
        const newEdges: Edge[] = clip.edges.map((e, i) => ({
          ...e,
          id: `edge-paste-${ts}-${i}`,
          source: idMap.get(String(e.source)) ?? String(e.source),
          target: idMap.get(String(e.target)) ?? String(e.target),
        }));
        setNodes((prev) => [
          ...prev.map((n) => ({ ...n, selected: false })),
          ...newNodes,
        ]);
        setEdges((prev) => [...prev, ...newEdges]);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [getNodes, getEdges, setNodes, setEdges]);

  /** Узлы и рёбра с учётом сворачивания: потомки свёрнутых узлов скрыты */
  const { nodesWithVisibility, edgesWithVisibility } = useMemo(() => {
    const childrenMap = new Map<string, string[]>();
    for (const e of edges) {
      if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
      childrenMap.get(e.source)!.push(e.target);
    }
    const hiddenIds = new Set<string>();
    for (const n of nodes) {
      const collapsed = (n.data as { collapsed?: boolean })?.collapsed;
      if (!collapsed) continue;
      const stack = [...(childrenMap.get(n.id) ?? [])];
      while (stack.length) {
        const id = stack.pop()!;
        hiddenIds.add(id);
        stack.push(...(childrenMap.get(id) ?? []));
      }
    }
    return {
      nodesWithVisibility: nodes.map((n) => ({ ...n, hidden: hiddenIds.has(n.id) })),
      edgesWithVisibility: edges.map((e) => ({
        ...e,
        hidden: hiddenIds.has(e.source) || hiddenIds.has(e.target),
      })),
    };
  }, [nodes, edges]);

  const handleSave = useCallback(
    (nodesToSave: Node[], edgesToSave: Edge[]) => {
      onSave(nodesToSave, edgesToSave);
    },
    [onSave]
  );

  const isLight = theme === 'light';
  const colorMode: ColorMode = theme;
  const hasSelectedNode = nodes.some((n) => n.selected);
  const neonGlow = hasSelectedNode
    ? 'ring-2 ring-green-400/70 shadow-[0_0_20px_rgba(34,197,94,0.45),0_0_40px_rgba(34,197,94,0.25)]'
    : 'ring-2 ring-violet-400/70 shadow-[0_0_20px_rgba(139,92,246,0.45),0_0_40px_rgba(139,92,246,0.25)]';
  const baseWrapper = isLight ? 'mindmap-editor w-full h-full bg-slate-100' : 'mindmap-editor w-full h-full bg-slate-900';
  const wrapperClass = `${baseWrapper} ${neonGlow}`;
  const flowClass = isLight ? 'bg-slate-100' : 'bg-slate-900';
  const controlsStyle = isLight ? controlsStyleLight : controlsStyleDark;
  const backgroundColor = isLight ? 'rgb(203 213 225)' : 'rgb(71 85 105)';
  const controlsClass = isLight ? '!bg-slate-200 !border-slate-300 !rounded-lg' : '!bg-slate-800 !border-slate-600 !rounded-lg';
  return (
    <div ref={containerRef} className={wrapperClass}>
      <style>{controlsStyle}</style>
      <ReactFlow
        nodes={nodesWithVisibility}
        edges={edgesWithVisibility}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={{ default: CyberNode }}
        edgeTypes={{ default: CyberEdge, straight: CyberEdge, smoothstep: CyberEdge, step: CyberEdge }}
        fitView
        colorMode={colorMode}
        className={`${flowClass} pr-64`}
      >
        <Background color={backgroundColor} gap={16} />
        <MindMapControls containerRef={containerRef} className={controlsClass} />
        <NodeSettingsSidebar />
        <FlowToolbar
          onSave={handleSave}
          saveLoading={saveLoading}
          workitemId={workitemId}
          theme={theme}
          onThemeChange={setTheme}
        />
      </ReactFlow>
    </div>
  );
}

export default function MindMapEditor(props: MindMapEditorProps) {
  const { initialNodes, initialEdges, workitemId, ...rest } = props;
  const nodesWithStyle = useMemo(
    () =>
      initialNodes.map((n) => {
        const d = n.data as { width?: number; height?: number };
        return {
          ...n,
          style: n.style ?? defaultNodeStyle,
          ...(d?.width != null && { width: d.width }),
          ...(d?.height != null && { height: d.height }),
        };
      }),
    [initialNodes]
  );

  return (
    <ReactFlowProvider>
      <EditorInner
        initialNodes={nodesWithStyle}
        initialEdges={initialEdges}
        workitemId={workitemId}
        {...rest}
      />
    </ReactFlowProvider>
  );
}
