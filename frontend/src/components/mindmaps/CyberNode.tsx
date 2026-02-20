import { useEffect, useRef } from 'react';
import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  useStore,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { ChevronDown, ChevronRight, Trash2, Move } from 'lucide-react';
import {
  DEFAULT_LABEL_COLOR,
  DEFAULT_LABEL_FONT_SIZE,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type CyberNodeData,
  type ShapeType,
} from './nodeConfig';

const WRAPPER_BG_DEFAULT = 'rgb(30 41 59)';
const WRAPPER_BORDER_DEFAULT = 'rgb(71 85 105)';
const CARD_BG_DEFAULT = '#0f172a';

type CyberNodeType = Node<CyberNodeData>;

export default function CyberNode({ id, data, selected, width: nodeWidth, height: nodeHeight }: NodeProps<CyberNodeType>) {
  const { updateNodeData, deleteElements, getNodes, setNodes } = useReactFlow();
  const edges = useStore((s) => s.edges ?? []);

  const label = data?.label ?? '';
  const color = data?.color;
  const wrapperEnabled = data?.wrapperEnabled !== false;
  const cardColor = data?.cardColor;
  const imageUrl = data?.image;
  const imageSize = data?.imageSize ?? 100;
  const linkUrl = data?.link;
  const shape = data?.shape ?? 'rectangle';
  const rotation = data?.rotation ?? 0;
  const width = nodeWidth ?? data?.width ?? DEFAULT_NODE_WIDTH;
  const height = nodeHeight ?? data?.height ?? DEFAULT_NODE_HEIGHT;
  const labelFontSize = data?.labelFontSize ?? DEFAULT_LABEL_FONT_SIZE;
  const labelColor = data?.labelColor ?? DEFAULT_LABEL_COLOR;
  const topText = data?.topText ?? '';
  const topTextColor = data?.topTextColor ?? DEFAULT_LABEL_COLOR;
  const topTextFontSize = data?.topTextFontSize ?? 12;
  const bottomText = data?.bottomText ?? '';
  const bottomTextColor = data?.bottomTextColor ?? DEFAULT_LABEL_COLOR;
  const bottomTextFontSize = data?.bottomTextFontSize ?? 12;
  const linkFontSize = data?.linkFontSize ?? 14;
  const collapsed = data?.collapsed ?? false;
  const borderColorData = data?.borderColor;
  /** При перетаскивании двигать и дочерние узлы (ветку). По умолчанию true. */
  const dragWithChildren = data?.dragWithChildren !== false;

  const hasChildren = edges.some((e) => String(e.source) === String(id));
  const labelWrapRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLTextAreaElement>(null);

  /** Hex #rrggbb → "r, g, b" для rgba(r, g, b, alpha). rgb(r g b) тоже поддерживается. */
  const hexToRgb = (c: string): string | null => {
    const hex = c.trim();
    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(hex)) {
      const n = parseInt(hex.slice(1), 16);
      const r = hex.length === 4 ? (n >> 8) * 17 : (n >> 16) & 0xff;
      const g = hex.length === 4 ? (n >> 4 & 0xf) * 17 : (n >> 8) & 0xff;
      const b = hex.length === 4 ? (n & 0xf) * 17 : n & 0xff;
      return `${r}, ${g}, ${b}`;
    }
    const rgb = /^rgb\s*\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\)$/.exec(hex);
    if (rgb) return `${rgb[1]}, ${rgb[2]}, ${rgb[3]}`;
    return null;
  };
  const toggleCollapsed = () => updateNodeData(id, { collapsed: !collapsed });

  // Корень узла всегда прозрачный — обёртка рисуется внутри вращаемого блока
  useEffect(() => {
    setNodes(getNodes().map((n) => {
      if (n.id !== id) return n;
      const bg = (n.style as React.CSSProperties)?.background;
      const border = (n.style as React.CSSProperties)?.border;
      if (bg === 'transparent' && border === 'none') return n;
      return {
        ...n,
        style: { ...n.style, background: 'transparent', border: 'none' },
      };
    }));
  }, [id, getNodes, setNodes]);

  // Подгонка высоты textarea под содержимое для вертикального центрирования
  useEffect(() => {
    const ta = labelRef.current;
    const wrap = labelWrapRef.current;
    if (!ta || !wrap) return;
    const maxH = wrap.clientHeight;
    ta.style.height = '0';
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`;
  }, [label, labelFontSize, width, height]);

  const deleteNode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  const getShapeClasses = (s: ShapeType): string => {
    switch (s) {
      case 'circle':
        return 'rounded-full aspect-square flex items-center justify-center text-center min-w-[60px]';
      case 'oval':
        return 'rounded-full aspect-[3/2] flex items-center justify-center text-center min-w-[80px]';
      case 'diamond':
        return 'rotate-45 aspect-square flex items-center justify-center min-w-[60px]';
      case 'hexagon':
        return '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)] aspect-[4/3] flex items-center justify-center min-w-[80px]';
      case 'triangle':
        return '[clip-path:polygon(50%_0%,100%_100%,0%_100%)] aspect-[4/3] flex items-center justify-center min-w-[60px]';
      case 'cloud':
        return 'rounded-[2.5rem] flex items-center justify-center text-center min-w-[80px]';
      default:
        return 'rounded-lg';
    }
  };

  const isComplexShape = shape === 'hexagon' || shape === 'diamond' || shape === 'triangle' || shape === 'oval' || shape === 'cloud';
  const defaultNeonSelected = '0 0 12px rgba(139,92,246,0.6), 0 0 24px rgba(139,92,246,0.35)';
  const defaultNeonUnselected = '0 0 12px rgba(34,197,94,0.6), 0 0 24px rgba(34,197,94,0.35)';
  const customRgb = borderColorData ? hexToRgb(borderColorData) : null;
  const borderColorValue = isComplexShape
    ? 'transparent'
    : borderColorData ?? (selected ? 'rgb(139, 92, 246)' : 'rgb(34, 197, 94)');
  const neonShadow = customRgb
    ? `0 0 12px rgba(${customRgb}, 0.6), 0 0 24px rgba(${customRgb}, 0.35)`
    : (selected ? defaultNeonSelected : defaultNeonUnselected);
  const nodeStyle: React.CSSProperties = {
    borderColor: borderColorValue,
    boxShadow: isComplexShape ? undefined : neonShadow,
    backgroundColor: cardColor || CARD_BG_DEFAULT,
  };

  const handleClass = '!bg-cyan-400 !w-3 !h-3 rounded-full';

  const borderClass = !isComplexShape ? 'border-2' : '';

  return (
    <>
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        className="nodrag nopan flex flex-col gap-px bg-slate-800 p-0.5 rounded-sm border border-slate-600 min-w-[50px]"
      >
        <div className="flex flex-col gap-px w-full">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleCollapsed(); }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={!hasChildren}
            className={`nodrag nopan w-full px-0.5 py-px text-[8px] rounded border inline-flex items-center justify-center gap-px leading-tight ${hasChildren
                ? collapsed
                  ? 'bg-cyan-600 border-cyan-500 text-white hover:bg-cyan-500 cursor-pointer'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 cursor-pointer'
                : 'bg-slate-700/50 border-slate-600 text-slate-500 cursor-not-allowed'
              }`}
            title={hasChildren ? (collapsed ? 'Развернуть дочерние узлы' : 'Свернуть дочерние узлы') : 'Нет дочерних узлов'}
          >
            <span className="pointer-events-none inline-flex shrink-0">
              {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
            </span>
            {hasChildren ? (collapsed ? 'Развернуть' : 'Свернуть') : 'Нет дочерних'}
          </button>
        </div>
        <div className="w-full border-t border-slate-600 pt-px mt-px">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              updateNodeData(id, { dragWithChildren: !dragWithChildren });
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`nodrag nopan w-full px-0.5 py-px text-[8px] rounded border inline-flex items-center justify-center gap-px leading-tight ${dragWithChildren
                ? 'bg-cyan-600 border-cyan-500 text-white hover:bg-cyan-500 cursor-pointer'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 cursor-pointer'
              }`}
            title={dragWithChildren ? 'Сейчас: с веткой. Нажмите — перетаскивать только узел.' : 'Сейчас: только узел. Нажмите — перетаскивать с дочерними.'}
          >
            <span className="pointer-events-none inline-flex shrink-0"><Move size={10} /></span>
            {dragWithChildren ? 'С веткой' : 'Только узел'}
          </button>
        </div>
        <div className="w-full border-t border-slate-600 pt-px mt-px">
          <button
            type="button"
            onClick={deleteNode}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nopan w-full px-0.5 py-px text-[8px] rounded border border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 hover:text-red-300 cursor-pointer inline-flex items-center justify-center gap-px leading-tight"
            title="Удалить узел"
          >
            <span className="pointer-events-none inline-flex shrink-0"><Trash2 size={10} /></span>
            Удалить узел
          </button>
        </div>
      </NodeToolbar>

      {/* Ручки изменения размера по граням карточки (видны при выделении) */}
      <NodeResizer
        minWidth={100}
        minHeight={44}
        isVisible={selected}
        lineClassName="!border-cyan-400"
        handleClassName="!w-2 !h-2 !rounded !bg-cyan-400 !border-2 !border-slate-800"
        onResizeEnd={(_evt, params) => {
          const w = Math.round(params.width);
          const h = Math.round(params.height);
          setNodes(
            getNodes().map((n) => {
              if (n.id !== id) return n;
              return {
                ...n,
                width: w,
                height: h,
                data: { ...n.data, width: w, height: h },
              };
            })
          );
        }}
      />
      {/* Корень без поворота — Handles и позиция узла фиксированы. Обёртка и карточка вращаются внутри. */}
      <div
        className="relative w-full h-full"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          minWidth: 100,
          minHeight: 44,
        }}
      >
        <Handle type="target" position={Position.Top} className={handleClass} />
        <div
          className="absolute inset-0 flex flex-col"
          style={{
            transformOrigin: '50% 50%',
            transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
          }}
        >
          {linkUrl ? (
            <a
              href={linkUrl}
              style={{ fontSize: linkFontSize }}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="nodrag nopan shrink-0 block text-xs text-cyan-400 hover:text-cyan-300 underline truncate w-full text-center py-0.5"
              title={linkUrl}
            >
              URL
            </a>
          ) : null}
          {/* Текст сверху — показывается только после добавления в сайдбаре */}
          {topText ? (
            <div className="shrink-0 min-w-0 w-full min-h-[1.5rem] max-h-[5rem] flex flex-col overflow-hidden mb-0.5">
              <textarea
                className="nodrag nopan w-full h-full min-h-[1.5rem] bg-transparent border-none outline-none text-center text-slate-100 resize-none overflow-auto text-xs"
                style={{
                  fontSize: topTextFontSize,
                  color: topTextColor,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                value={topText}
                onChange={(evt) => updateNodeData(id, { topText: evt.target.value })}
                onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }}
                placeholder="Текст над узлом"
              />
            </div>
          ) : null}
          {/* Обёртка (фон + рамка) — рисуется здесь, вращается вместе с карточкой */}
          <div
            className="flex-1 min-w-0 min-h-0 rounded-lg"
            style={{
              background: wrapperEnabled ? (color || WRAPPER_BG_DEFAULT) : 'transparent',
              border: wrapperEnabled ? `1px solid ${WRAPPER_BORDER_DEFAULT}` : 'none',
            }}
          >
            <div
              className={`shadow-md border-2 px-2 py-1.5 w-full h-full min-w-0 min-h-0 flex flex-col overflow-hidden relative ${getShapeClasses(shape)} ${!isComplexShape ? borderClass : ''}`}
              style={nodeStyle}
            >
              {imageUrl && (
                <div className="absolute inset-0 z-0 overflow-hidden">
                  <img
                    src={imageUrl}
                    alt=""
                    className="nodrag w-full h-full object-cover pointer-events-none"
                    style={{
                      transform: `scale(${imageSize / 100})`,
                      transformOrigin: 'center center',
                    }}
                  />
                </div>
              )}
              <div
                className={
                  shape === 'diamond'
                    ? '-rotate-45 flex flex-col items-center justify-center flex-1 min-h-0 min-w-0 relative z-10'
                    : 'flex flex-col flex-1 min-h-0 min-w-0 items-center justify-center relative z-10'
                }
              >
                {/* Название — центрировано по вертикали и горизонтали; автоперенос по словам */}
                <div ref={labelWrapRef} className="min-w-0 min-h-0 flex-1 flex flex-col items-center justify-center overflow-hidden w-full">
                  <textarea
                    ref={labelRef}
                    className="nodrag nopan w-full min-h-0 bg-transparent border-none outline-none text-center text-slate-100 font-medium resize-none overflow-auto"
                    style={{
                      fontSize: labelFontSize,
                      color: labelColor,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                    value={label}
                    onChange={(evt) => {
                      updateNodeData(id, { label: evt.target.value });
                      const ta = evt.target;
                      const wrap = labelWrapRef.current;
                      if (wrap) {
                        ta.style.height = '0';
                        ta.style.height = `${Math.min(ta.scrollHeight, wrap.clientHeight)}px`;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                    }}
                    placeholder="Название (несколько строк — Enter)"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Текст (снизу) — показывается только после добавления в сайдбаре */}
          {bottomText ? (
            <div className="shrink-0 min-w-0 w-full min-h-[1.5rem] max-h-[5rem] flex flex-col overflow-hidden mt-0.5">
              <textarea
                className="nodrag nopan w-full h-full min-h-[1.5rem] bg-transparent border-none outline-none text-center text-slate-100 resize-none overflow-auto text-xs"
                style={{
                  fontSize: bottomTextFontSize,
                  color: bottomTextColor,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                value={bottomText}
                onChange={(evt) => updateNodeData(id, { bottomText: evt.target.value })}
                onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }}
                placeholder="Текст под узлом"
              />
            </div>
          ) : null}
        </div>
        <Handle type="source" position={Position.Bottom} className={handleClass} />
      </div>
    </>
  );
}
