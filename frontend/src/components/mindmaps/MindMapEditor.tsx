import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
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
import { useMutation } from '@tanstack/react-query';
import { mindmapsApi } from '../../api/mindmaps';
import toast from 'react-hot-toast';
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
  id?: number;
  initialNodes: Node[];
  initialEdges: Edge[];
  onSave: (nodes: Node[], edges: Edge[]) => void;
  saveLoading?: boolean;
  workitemId?: number;
  projectId?: number;
}

type BackgroundTool = 'select' | 'pen' | 'eraser' | 'rect' | 'circle' | 'triangle' | 'image';

type BgPoint = { x: number; y: number };

type BgPathItem = {
  id: string;
  kind: 'path';
  points: BgPoint[];
  color: string;
  width: number;
};

type BgShapeKind = 'rect' | 'circle' | 'triangle' | 'image';
type BgShapeItem = {
  id: string;
  kind: BgShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  src?: string;
};

type BgItem = BgPathItem | BgShapeItem;

function uid(prefix = 'bg'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function distToSegment(p: BgPoint, a: BgPoint, b: BgPoint): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

function pointToLocalShape(point: BgPoint, shape: BgShapeItem): BgPoint {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const ang = (-shape.rotation * Math.PI) / 180;
  const dx = point.x - cx;
  const dy = point.y - cy;
  return {
    x: dx * Math.cos(ang) - dy * Math.sin(ang) + shape.width / 2,
    y: dx * Math.sin(ang) + dy * Math.cos(ang) + shape.height / 2,
  };
}

function hitShape(shape: BgShapeItem, point: BgPoint): boolean {
  const p = pointToLocalShape(point, shape);
  if (p.x < 0 || p.y < 0 || p.x > shape.width || p.y > shape.height) return false;
  if (shape.kind === 'circle') {
    const rx = shape.width / 2;
    const ry = shape.height / 2;
    const nx = (p.x - rx) / (rx || 1);
    const ny = (p.y - ry) / (ry || 1);
    return nx * nx + ny * ny <= 1;
  }
  if (shape.kind === 'triangle') {
    const p0 = { x: shape.width / 2, y: 0 };
    const p1 = { x: 0, y: shape.height };
    const p2 = { x: shape.width, y: shape.height };
    const area = (a: BgPoint, b: BgPoint, c: BgPoint) => Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2);
    const total = area(p0, p1, p2);
    const a1 = area(p, p1, p2);
    const a2 = area(p0, p, p2);
    const a3 = area(p0, p1, p);
    return Math.abs(total - (a1 + a2 + a3)) < 0.5;
  }
  return true;
}

function pointsToPath(points: BgPoint[]): string {
  if (!points.length) return '';
  return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
}

function trianglePoints(shape: BgShapeItem): string {
  return `${shape.width / 2},0 0,${shape.height} ${shape.width},${shape.height}`;
}

function MindMapBackgroundLayer({
  items,
  setItems,
  selectedId,
  setSelectedId,
  tool,
  color,
  size,
  pendingImageSrc,
  onImagePlaced,
  enabled,
  isLight,
}: {
  items: BgItem[];
  setItems: Dispatch<SetStateAction<BgItem[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  tool: BackgroundTool;
  color: string;
  size: number;
  pendingImageSrc: string | null;
  onImagePlaced: () => void;
  enabled: boolean;
  isLight: boolean;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const transform = useStore((s) => s.transform);
  const [tx, ty, zoom] = transform;
  const [draftShape, setDraftShape] = useState<null | { kind: Exclude<BgShapeKind, 'image'>; start: BgPoint; current: BgPoint }>(null);
  const actionRef = useRef<
    | { type: 'none' }
    | { type: 'draw'; id: string }
    | { type: 'drag'; id: string; offsetX: number; offsetY: number }
    | { type: 'erase' }
  >({ type: 'none' });

  const toWorld = useCallback(
    (e: PointerEvent | React.PointerEvent): BgPoint => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (e.clientX - rect.left - tx) / zoom,
        y: (e.clientY - rect.top - ty) / zoom,
      };
    },
    [tx, ty, zoom]
  );

  const eraseAt = useCallback(
    (point: BgPoint) => {
      setItems((prev) => {
        for (let i = prev.length - 1; i >= 0; i -= 1) {
          const item = prev[i];
          if (item.kind === 'path') {
            for (let p = 0; p < item.points.length - 1; p += 1) {
              if (distToSegment(point, item.points[p], item.points[p + 1]) <= Math.max(item.width * 1.2, 8 / zoom)) {
                if (selectedId === item.id) setSelectedId(null);
                return prev.filter((x) => x.id !== item.id);
              }
            }
            continue;
          }
          if (hitShape(item, point)) {
            if (selectedId === item.id) setSelectedId(null);
            return prev.filter((x) => x.id !== item.id);
          }
        }
        return prev;
      });
    },
    [setItems, selectedId, setSelectedId, zoom]
  );

  const findTopItemAt = useCallback(
    (point: BgPoint): BgItem | null => {
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        if (item.kind === 'path') {
          for (let p = 0; p < item.points.length - 1; p += 1) {
            if (distToSegment(point, item.points[p], item.points[p + 1]) <= Math.max(item.width * 1.2, 8 / zoom)) {
              return item;
            }
          }
        } else if (hitShape(item, point)) {
          return item;
        }
      }
      return null;
    },
    [items, zoom]
  );

  const activePointerIdRef = useRef<number | null>(null);

  const finishDraftShape = useCallback(() => {
    setDraftShape((prev) => {
      if (!prev) return prev;
      const x = Math.min(prev.start.x, prev.current.x);
      const y = Math.min(prev.start.y, prev.current.y);
      const width = Math.max(16, Math.abs(prev.current.x - prev.start.x));
      const height = Math.max(16, Math.abs(prev.current.y - prev.start.y));
      const shape: BgShapeItem = {
        id: uid(prev.kind),
        kind: prev.kind,
        x,
        y,
        width,
        height,
        rotation: 0,
        color,
      };
      setItems((itemsPrev) => [...itemsPrev, shape]);
      setSelectedId(shape.id);
      return null;
    });
    actionRef.current = { type: 'none' };
    activePointerIdRef.current = null;
  }, [color, setItems, setSelectedId]);

  useEffect(() => {
    if (!enabled) {
      actionRef.current = { type: 'none' };
      activePointerIdRef.current = null;
      setDraftShape(null);
      return;
    }

    const isPaneTarget = (e: PointerEvent): boolean => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      return !!el?.closest('.react-flow__pane');
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !isPaneTarget(e)) return;
      const point = toWorld(e);
      activePointerIdRef.current = e.pointerId;

      if (tool === 'eraser') {
        actionRef.current = { type: 'erase' };
        eraseAt(point);
        return;
      }

      if (tool === 'pen') {
        const id = uid('path');
        const path: BgPathItem = { id, kind: 'path', points: [point], color, width: size };
        setItems((prev) => [...prev, path]);
        setSelectedId(id);
        actionRef.current = { type: 'draw', id };
        return;
      }

      if (tool === 'image') {
        if (!pendingImageSrc) return;
        const img: BgShapeItem = {
          id: uid('img'),
          kind: 'image',
          x: point.x - 110,
          y: point.y - 70,
          width: 220,
          height: 140,
          rotation: 0,
          color: '#ffffff',
          src: pendingImageSrc,
        };
        setItems((prev) => [...prev, img]);
        setSelectedId(img.id);
        onImagePlaced();
        return;
      }

      if (tool === 'rect' || tool === 'circle' || tool === 'triangle') {
        setDraftShape({ kind: tool, start: point, current: point });
        return;
      }

      const hit = findTopItemAt(point);
      if (hit) {
        setSelectedId(hit.id);
        if (hit.kind !== 'path') {
          actionRef.current = {
            type: 'drag',
            id: hit.id,
            offsetX: point.x - hit.x,
            offsetY: point.y - hit.y,
          };
        } else {
          actionRef.current = { type: 'none' };
        }
      } else {
        setSelectedId(null);
        actionRef.current = { type: 'none' };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      const point = toWorld(e);

      if (actionRef.current.type === 'erase') {
        eraseAt(point);
        return;
      }

      if (actionRef.current.type === 'draw') {
        const id = actionRef.current.id;
        setItems((prev) =>
          prev.map((item) =>
            item.kind === 'path' && item.id === id
              ? { ...item, points: [...item.points, point] }
              : item
          )
        );
        return;
      }

      if (actionRef.current.type === 'drag') {
        const { id, offsetX, offsetY } = actionRef.current;
        setItems((prev) =>
          prev.map((item) =>
            item.kind !== 'path' && item.id === id
              ? { ...item, x: point.x - offsetX, y: point.y - offsetY }
              : item
          )
        );
        return;
      }

      setDraftShape((prev) => (prev ? { ...prev, current: point } : prev));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      finishDraftShape();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
    };
  }, [
    enabled,
    toWorld,
    tool,
    eraseAt,
    color,
    size,
    setItems,
    setSelectedId,
    pendingImageSrc,
    onImagePlaced,
    findTopItemAt,
    finishDraftShape,
  ]);

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 pointer-events-none z-[1]"
    >
      <svg width="100%" height="100%" className={isLight ? 'bg-transparent' : 'bg-transparent'}>
        <g transform={`translate(${tx} ${ty}) scale(${zoom})`}>
          {items.map((item) => {
            if (item.kind === 'path') {
              return (
                <path
                  key={item.id}
                  d={pointsToPath(item.points)}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={item.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={selectedId === item.id ? 1 : 0.95}
                />
              );
            }
            const tr = `translate(${item.x} ${item.y}) rotate(${item.rotation} ${item.width / 2} ${item.height / 2})`;
            return (
              <g key={item.id} transform={tr}>
                {item.kind === 'rect' && (
                  <rect x={0} y={0} width={item.width} height={item.height} fill={item.color} fillOpacity={0.35} stroke={item.color} strokeWidth={2} />
                )}
                {item.kind === 'circle' && (
                  <ellipse cx={item.width / 2} cy={item.height / 2} rx={item.width / 2} ry={item.height / 2} fill={item.color} fillOpacity={0.35} stroke={item.color} strokeWidth={2} />
                )}
                {item.kind === 'triangle' && (
                  <polygon points={trianglePoints(item)} fill={item.color} fillOpacity={0.35} stroke={item.color} strokeWidth={2} />
                )}
                {item.kind === 'image' && item.src && (
                  <image href={item.src} x={0} y={0} width={item.width} height={item.height} preserveAspectRatio="none" />
                )}
                {selectedId === item.id && (
                  <rect
                    x={-3}
                    y={-3}
                    width={item.width + 6}
                    height={item.height + 6}
                    fill="none"
                    stroke="#f59e0b"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                  />
                )}
                {selectedId === item.id && (
                  <circle cx={item.width / 2} cy={-16} r={5} fill="#f59e0b" stroke="#111827" strokeWidth={1.5} />
                )}
                {selectedId === item.id && (
                  <line x1={item.width / 2} y1={0} x2={item.width / 2} y2={-16} stroke="#f59e0b" strokeWidth={1.2} />
                )}
              </g>
            );
          })}

          {draftShape && (
            <g
              transform={`translate(${Math.min(draftShape.start.x, draftShape.current.x)} ${Math.min(draftShape.start.y, draftShape.current.y)})`}
            >
              {(() => {
                const w = Math.max(16, Math.abs(draftShape.current.x - draftShape.start.x));
                const h = Math.max(16, Math.abs(draftShape.current.y - draftShape.start.y));
                if (draftShape.kind === 'rect') return <rect x={0} y={0} width={w} height={h} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2} />;
                if (draftShape.kind === 'circle') return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2} />;
                return <polygon points={`${w / 2},0 0,${h} ${w},${h}`} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2} />;
              })()}
            </g>
          )}

          {/* Визуальный центр выбранной фигуры для вращения (без хендла drag в этой версии) */}
          {(() => {
            const selected = items.find((i) => i.id === selectedId);
            if (!selected || selected.kind === 'path') return null;
            const cx = selected.x + selected.width / 2;
            const cy = selected.y + selected.height / 2;
            return <circle cx={cx} cy={cy} r={2.5} fill="#f59e0b" />;
          })()}
        </g>
      </svg>
    </div>
  );
}

/** Панель инструментов — должна рендериться внутри ReactFlow, чтобы useReactFlow() работал. */
function FlowToolbar({
  id,
  onSave,
  saveLoading,
  workitemId,
  theme,
  onThemeChange,
  backgroundEditOpen,
  onToggleBackgroundEdit,
  backgroundTool,
  onBackgroundToolChange,
  backgroundColor,
  onBackgroundColorChange,
  backgroundSize,
  onBackgroundSizeChange,
  pendingImageReady,
  onImageFileSelect,
  onImportFileSelect,
  selectedBgItem,
  onUpdateSelectedBgItem,
  onDeleteSelectedBgItem,
}: {
  id?: number;
  onSave: (nodes: Node[], edges: Edge[]) => void;
  saveLoading?: boolean;
  workitemId?: number;
  theme: MindMapTheme;
  onThemeChange: (theme: MindMapTheme) => void;
  backgroundEditOpen: boolean;
  onToggleBackgroundEdit: () => void;
  backgroundTool: BackgroundTool;
  onBackgroundToolChange: (tool: BackgroundTool) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  backgroundSize: number;
  onBackgroundSizeChange: (size: number) => void;
  pendingImageReady: boolean;
  onImageFileSelect: (file: File) => void;
  onImportFileSelect: (file: File) => void;
  selectedBgItem: BgShapeItem | null;
  onUpdateSelectedBgItem: (patch: Partial<BgShapeItem>) => void;
  onDeleteSelectedBgItem: () => void;
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

  const handleExportPng = useCallback(async () => {
    if (!domNode) return;
    setExporting('png');
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(domNode, exportOptions);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `mindmap-${Date.now()}.png`;
      a.click();
    } catch (err) {
      console.error('Export PNG failed', err);
    } finally {
      setExporting(null);
    }
  }, [domNode]);

  const handleExportJpg = useCallback(async () => {
    if (!domNode) return;
    setExporting('jpg');
    try {
      const { toJpeg } = await import('html-to-image');
      const dataUrl = await toJpeg(domNode, { ...exportOptions, quality: 0.95 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `mindmap-${Date.now()}.jpg`;
      a.click();
    } catch (err) {
      console.error('Export JPG failed', err);
    } finally {
      setExporting(null);
    }
  }, [domNode]);

  const handleExportPdf = useCallback(async () => {
    if (!domNode) return;
    setExporting('pdf');
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      const dataUrl = await toPng(domNode, exportOptions);
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
    } catch (err) {
      console.error('Export PDF failed', err);
      setExporting(null);
    }
  }, [domNode]);

  const exportToFileMutation = useMutation({
    mutationFn: (mapId: number) => mindmapsApi.exportToFile(mapId),
    onSuccess: () => {
      toast.success('Карта экспортирована в файлы проекта');
    },
    onError: (error: unknown) => {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      // Для paywall-кодов модалка открывается глобально в axios interceptor.
      if (code === 'LIMIT_REACHED' || code === 'FEATURE_LOCKED') return;
      toast.error('Ошибка экспорта в файл');
    },
  });

  const handleExportToFile = useCallback(() => {
    if (id) {
      exportToFileMutation.mutate(id);
    } else {
      toast.error('Сначала сохраните карту');
    }
  }, [id, exportToFileMutation]);

  const isLight = theme === 'light';
  const panelClass = isLight
    ? 'bg-slate-100/95 border-slate-300 text-slate-800'
    : 'bg-slate-800/95 border-slate-600 text-slate-100';
  const btnSecondaryClass = isLight
    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'
    : 'bg-slate-600 hover:bg-slate-500 text-white border-slate-500';
  const toolButtonClass = (active: boolean) =>
    `px-1.5 py-0.5 rounded text-xs font-medium border ${active ? 'bg-violet-600 text-white border-violet-500' : btnSecondaryClass}`;

  return (
    <Panel position="top-left" className="flex flex-col gap-1">
      <input
        type="file"
        accept="image/*"
        id="mindmap-bg-image-input"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImageFileSelect(file);
          e.currentTarget.value = '';
        }}
      />
      <input
        type="file"
        accept="application/json,.json"
        id="mindmap-import-json-input"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportFileSelect(file);
          e.currentTarget.value = '';
        }}
      />
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

        <button
          type="button"
          onClick={onToggleBackgroundEdit}
          className={`px-1.5 py-0.5 rounded text-xs font-medium border ${backgroundEditOpen ? 'bg-violet-600 text-white border-violet-500' : btnSecondaryClass}`}
          title="Инструменты рисования фона"
        >
          🖌️ Фон
        </button>

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

        <button
          type="button"
          onClick={handleExportToFile}
          disabled={!id || exportToFileMutation.isPending}
          className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium disabled:opacity-50"
          title="Сохранить в файлы проекта"
        >
          {exportToFileMutation.isPending ? '…' : 'В файлы проекта'}
        </button>
        <label
          htmlFor="mindmap-import-json-input"
          className={`px-1.5 py-0.5 rounded text-xs font-medium border cursor-pointer ${btnSecondaryClass}`}
          title="Импортировать карту из JSON"
        >
          Импорт JSON
        </label>

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

      {backgroundEditOpen && (
        <div className={`max-w-[540px] flex flex-wrap items-center gap-1 p-2 rounded-md border shadow ${panelClass}`}>
          <span className="text-[10px] opacity-80 mr-1">Режим рисования включён</span>
          <span className="text-[10px] opacity-80 mr-1">Инструмент:</span>
          <button type="button" onClick={() => onBackgroundToolChange('select')} className={toolButtonClass(backgroundTool === 'select')}>Курсор</button>
          <button type="button" onClick={() => onBackgroundToolChange('pen')} className={toolButtonClass(backgroundTool === 'pen')}>Перо</button>
          <button type="button" onClick={() => onBackgroundToolChange('eraser')} className={toolButtonClass(backgroundTool === 'eraser')}>Ластик</button>
          <button type="button" onClick={() => onBackgroundToolChange('rect')} className={toolButtonClass(backgroundTool === 'rect')}>Квадрат</button>
          <button type="button" onClick={() => onBackgroundToolChange('circle')} className={toolButtonClass(backgroundTool === 'circle')}>Круг</button>
          <button type="button" onClick={() => onBackgroundToolChange('triangle')} className={toolButtonClass(backgroundTool === 'triangle')}>Треугольник</button>
          <button type="button" onClick={() => onBackgroundToolChange('image')} className={toolButtonClass(backgroundTool === 'image')}>
            Картинка{pendingImageReady ? ' ✓' : ''}
          </button>
          <label
            htmlFor="mindmap-bg-image-input"
            className={`px-1.5 py-0.5 rounded text-xs font-medium border cursor-pointer ${btnSecondaryClass}`}
            title="Загрузить изображение для инструмента 'Картинка'"
          >
            Загрузить
          </label>

          <div className="w-px self-stretch bg-slate-400/50 mx-0.5" aria-hidden />
          <span className="text-[10px] opacity-80">Цвет:</span>
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => onBackgroundColorChange(e.target.value)}
            className="w-7 h-6 p-0 border-0 bg-transparent cursor-pointer"
            title="Цвет пера/фигуры"
          />
          <span className="text-[10px] opacity-80">Размер:</span>
          <input
            type="range"
            min={1}
            max={40}
            value={backgroundSize}
            onChange={(e) => onBackgroundSizeChange(Number(e.target.value))}
            className="w-24"
            title="Толщина пера / базовый размер"
          />
          <span className="text-[10px] opacity-80 w-6 text-right">{backgroundSize}</span>

          {selectedBgItem && (
            <>
              <div className="w-px self-stretch bg-slate-400/50 mx-0.5" aria-hidden />
              <span className="text-[10px] opacity-80">W</span>
              <input
                type="range"
                min={20}
                max={1200}
                value={Math.round(selectedBgItem.width)}
                onChange={(e) => onUpdateSelectedBgItem({ width: Number(e.target.value) })}
                className="w-20"
                title="Ширина выбранного объекта"
              />
              <span className="text-[10px] opacity-80">H</span>
              <input
                type="range"
                min={20}
                max={1200}
                value={Math.round(selectedBgItem.height)}
                onChange={(e) => onUpdateSelectedBgItem({ height: Number(e.target.value) })}
                className="w-20"
                title="Высота выбранного объекта"
              />
              <span className="text-[10px] opacity-80">⟲</span>
              <input
                type="range"
                min={-180}
                max={180}
                value={Math.round(selectedBgItem.rotation)}
                onChange={(e) => onUpdateSelectedBgItem({ rotation: Number(e.target.value) })}
                className="w-20"
                title="Поворот выбранного объекта"
              />
              <button
                type="button"
                onClick={onDeleteSelectedBgItem}
                className="px-1.5 py-0.5 rounded text-xs font-medium border bg-red-600 hover:bg-red-500 border-red-500 text-white"
              >
                Удалить
              </button>
            </>
          )}
        </div>
      )}
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
  id,
  initialNodes,
  initialEdges,
  onSave,
  saveLoading,
  workitemId,
}: Omit<MindMapEditorProps, 'projectId'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { getNodes, getEdges } = useReactFlow();
  const [theme, setTheme] = useState<MindMapTheme>('dark');
  const [backgroundEditOpen, setBackgroundEditOpen] = useState(false);
  const [backgroundTool, setBackgroundTool] = useState<BackgroundTool>('pen');
  const [drawingColor, setDrawingColor] = useState('#22c55e');
  const [drawingSize, setDrawingSize] = useState(4);
  const [backgroundItems, setBackgroundItems] = useState<BgItem[]>([]);
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);

  const importDataMutation = useMutation({
    mutationFn: ({ mapId, file }: { mapId: number; file: File }) => mindmapsApi.importData(mapId, file),
    onSuccess: (updated) => {
      setNodes((updated.nodes as Node[]) || []);
      setEdges((updated.edges as Edge[]) || []);
      toast.success('Карта успешно импортирована');
    },
    onError: (error: unknown) => {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'LIMIT_REACHED' || code === 'FEATURE_LOCKED') return;
      toast.error('Ошибка импорта карты');
    },
  });

  const uploadMapImageMutation = useMutation({
    mutationFn: ({ mapId, file }: { mapId: number; file: File }) => mindmapsApi.uploadMapImage(mapId, file),
    onSuccess: (result) => {
      if (result?.image_url) {
        setPendingImageSrc(result.image_url);
        setBackgroundTool('image');
      }
      toast.success('Изображение загружено');
    },
    onError: (error: unknown) => {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'LIMIT_REACHED' || code === 'FEATURE_LOCKED') return;
      toast.error('Ошибка загрузки изображения');
    },
  });

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
  const drawingModeActive = backgroundEditOpen && backgroundTool !== 'select';
  const selectedBgItem = useMemo(
    () => {
      const item = backgroundItems.find((x) => x.id === selectedBgId);
      return item && item.kind !== 'path' ? item : null;
    },
    [backgroundItems, selectedBgId]
  );

  const handleImageFileSelect = useCallback((file: File) => {
    if (id) {
      uploadMapImageMutation.mutate({ mapId: id, file });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (dataUrl) {
        setPendingImageSrc(dataUrl);
        setBackgroundTool('image');
      }
    };
    reader.readAsDataURL(file);
  }, [id, uploadMapImageMutation]);

  const handleImportFileSelect = useCallback((file: File) => {
    if (!id) {
      toast.error('Сначала сохраните карту');
      return;
    }
    importDataMutation.mutate({ mapId: id, file });
  }, [id, importDataMutation]);

  const handleUpdateSelectedBgItem = useCallback((patch: Partial<BgShapeItem>) => {
    if (!selectedBgId) return;
    setBackgroundItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedBgId || item.kind === 'path') return item;
        const next = { ...item, ...patch };
        return {
          ...next,
          width: Math.max(16, next.width),
          height: Math.max(16, next.height),
        };
      })
    );
  }, [selectedBgId]);

  const handleDeleteSelectedBgItem = useCallback(() => {
    if (!selectedBgId) return;
    setBackgroundItems((prev) => prev.filter((x) => x.id !== selectedBgId));
    setSelectedBgId(null);
  }, [selectedBgId]);

  const backgroundEditStyle = `
    .mindmap-editor.bg-edit-mode .react-flow__panel,
    .mindmap-editor.bg-edit-mode .react-flow__controls {
      pointer-events: all !important;
      z-index: 90 !important;
    }
    .mindmap-editor.bg-edit-mode .react-flow__controls {
      width: auto !important;
      height: auto !important;
      max-width: none !important;
      max-height: none !important;
      display: inline-flex !important;
      overflow: visible !important;
    }
  `;
  return (
    <div ref={containerRef} className={`${wrapperClass} ${backgroundEditOpen ? 'bg-edit-mode relative' : 'relative'}`}>
      <style>{controlsStyle}</style>
      <style>{backgroundEditStyle}</style>
      <MindMapBackgroundLayer
        items={backgroundItems}
        setItems={setBackgroundItems}
        selectedId={selectedBgId}
        setSelectedId={setSelectedBgId}
        tool={backgroundTool}
        color={drawingColor}
        size={drawingSize}
        pendingImageSrc={pendingImageSrc}
        onImagePlaced={() => setPendingImageSrc(null)}
        enabled={backgroundEditOpen}
        isLight={isLight}
      />
      <ReactFlow
        nodes={nodesWithVisibility}
        edges={edgesWithVisibility}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={{ default: CyberNode as any }}
        edgeTypes={{
          default: CyberEdge as any,
          straight: CyberEdge as any,
          smoothstep: CyberEdge as any,
          step: CyberEdge as any,
        }}
        fitView
        colorMode={colorMode}
        panOnDrag={!drawingModeActive}
        selectionOnDrag={!drawingModeActive}
        panOnScroll={!drawingModeActive}
        zoomOnDoubleClick={!drawingModeActive}
        className={`${flowClass} pr-64 !bg-transparent relative z-30`}
      >
        <Background color={backgroundColor} gap={16} />
        <MindMapControls containerRef={containerRef} className={controlsClass} />
        <NodeSettingsSidebar />
        <FlowToolbar
          id={id}
          onSave={handleSave}
          saveLoading={saveLoading}
          workitemId={workitemId}
          theme={theme}
          onThemeChange={setTheme}
          backgroundEditOpen={backgroundEditOpen}
          onToggleBackgroundEdit={() => setBackgroundEditOpen((v) => !v)}
          backgroundTool={backgroundTool}
          onBackgroundToolChange={setBackgroundTool}
          backgroundColor={drawingColor}
          onBackgroundColorChange={setDrawingColor}
          backgroundSize={drawingSize}
          onBackgroundSizeChange={setDrawingSize}
          pendingImageReady={!!pendingImageSrc}
          onImageFileSelect={handleImageFileSelect}
          onImportFileSelect={handleImportFileSelect}
          selectedBgItem={selectedBgItem}
          onUpdateSelectedBgItem={handleUpdateSelectedBgItem}
          onDeleteSelectedBgItem={handleDeleteSelectedBgItem}
        />
      </ReactFlow>
    </div>
  );
}

export default function MindMapEditor(props: MindMapEditorProps) {
  const { id, initialNodes, initialEdges, workitemId, ...rest } = props;
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
        id={id}
        initialNodes={nodesWithStyle}
        initialEdges={initialEdges}
        workitemId={workitemId}
        {...rest}
      />
    </ReactFlowProvider>
  );
}
