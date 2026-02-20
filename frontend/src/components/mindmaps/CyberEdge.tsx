import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeToolbar,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  useReactFlow,
  useStore,
  type EdgeProps,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export type EdgeStyleType = 'solid' | 'dashed' | 'dotted';

/** Тип линии: default = bezier, straight, smoothstep, step */
export type EdgePathType = 'default' | 'straight' | 'smoothstep' | 'step';

/** Размер обёртки надписи на линии */
export type EdgeLabelWrapperSize = 'small' | 'medium' | 'large';

export type CyberEdgeData = {
  style?: EdgeStyleType;
  color?: string;
  /** Толщина линии (px) */
  strokeWidth?: number;
  label?: string;
  /** Цвет текста надписи на линии */
  labelColor?: string;
  /** Размер шрифта надписи (px) */
  labelFontSize?: number;
  /** Поворот надписи в градусах */
  labelRotation?: number;
  /** Цвет фона обёртки надписи */
  labelWrapperColor?: string;
  /** Размер обёртки надписи */
  labelWrapperSize?: EdgeLabelWrapperSize;
};

const STROKE_DASH: Record<EdgeStyleType, string | undefined> = {
  solid: undefined,
  dashed: '28 14',
  dotted: '12 10',
};

const DEFAULT_COLOR = '#22d3ee';
const DEFAULT_LABEL_COLOR = '#e2e8f0';
const DEFAULT_LABEL_FONT_SIZE = 12;
const DEFAULT_STROKE_WIDTH = 2;
const DEFAULT_WRAPPER_COLOR = 'rgb(30 41 59)';

const WRAPPER_SIZE_PADDING: Record<EdgeLabelWrapperSize, string> = {
  small: '2px 4px',
  medium: '4px 6px',
  large: '6px 10px',
};

const PATH_TYPE_OPTIONS: { value: EdgePathType; label: string }[] = [
  { value: 'default', label: 'Bezier' },
  { value: 'straight', label: 'Прямая' },
  { value: 'smoothstep', label: 'Smoothstep' },
  { value: 'step', label: 'Step' },
];

export default function CyberEdge({
  id,
  data,
  selected,
  ...pathProps
}: EdgeProps<CyberEdgeData>) {
  const { updateEdgeData, deleteElements, getEdges, setEdges } = useReactFlow();
  const edgeType = useStore((s) => s.edges.find((e) => e.id === id)?.type) ?? 'default';
  const pathType = (edgeType === undefined || edgeType === 'default' ? 'default' : edgeType) as EdgePathType;

  const pathResult =
    pathType === 'straight'
      ? getStraightPath(pathProps)
      : pathType === 'smoothstep'
        ? getSmoothStepPath(pathProps)
        : pathType === 'step'
          ? getSmoothStepPath({ ...pathProps, borderRadius: 0 })
          : getBezierPath(pathProps);
  const [edgePath, centerX, centerY] = pathResult;

  const style = data?.style ?? 'solid';
  const color = data?.color ?? DEFAULT_COLOR;
  const strokeWidth = data?.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const label = data?.label ?? '';
  const labelColor = data?.labelColor ?? DEFAULT_LABEL_COLOR;
  const labelFontSize = data?.labelFontSize ?? DEFAULT_LABEL_FONT_SIZE;
  const labelRotation = data?.labelRotation ?? 0;
  const labelWrapperColor = data?.labelWrapperColor ?? DEFAULT_WRAPPER_COLOR;
  const labelWrapperSize = data?.labelWrapperSize ?? 'medium';
  const strokeDasharray = STROKE_DASH[style];

  const edgeStyle = {
    stroke: color,
    strokeWidth,
    strokeDasharray,
  };

  const changePathType = (newType: EdgePathType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = newType === 'default' ? undefined : newType;
    setEdges(getEdges().map((e) => (e.id === id ? { ...e, type: next } : e)));
  };

  const changeStyle = (newStyle: EdgeStyleType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateEdgeData(id, { style: newStyle });
  };

  const deleteEdge = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteElements({ edges: [{ id }] });
  };

  const labelTransform = `translate(-50%, -50%) translate(${centerX}px,${centerY}px) rotate(${labelRotation}deg)`;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        {...pathProps}
        style={edgeStyle}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: labelTransform,
              color: labelColor,
              fontSize: labelFontSize,
              padding: WRAPPER_SIZE_PADDING[labelWrapperSize],
              background: labelWrapperColor,
              border: '1px solid rgb(71 85 105)',
              borderRadius: 4,
              pointerEvents: 'all',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      <EdgeToolbar
        edgeId={id}
        x={centerX}
        y={centerY}
        isVisible={selected}
        alignX="center"
        alignY="center"
        className="nodrag nopan flex flex-col gap-px bg-slate-800 p-0.5 rounded-sm border border-slate-600 shadow min-w-[40px]"
      >
        <div className="flex flex-col w-full">
          <div className="grid grid-cols-2 gap-px">
            {PATH_TYPE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={(e) => changePathType(value, e)}
                onPointerDown={(e) => e.stopPropagation()}
                className={`nodrag nopan px-0.5 py-px text-[8px] rounded-sm border cursor-pointer leading-tight ${
                  pathType === value
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                }`}
                title={label}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col w-full">
          <div className="flex gap-px flex-wrap">
            <button
              type="button"
              onClick={(e) => changeStyle('solid', e)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`nodrag nopan px-0.5 py-px text-[8px] rounded-sm border cursor-pointer ${
                style === 'solid'
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
              }`}
              title="Сплошная"
            >
              —
            </button>
            <button
              type="button"
              onClick={(e) => changeStyle('dashed', e)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`nodrag nopan px-0.5 py-px text-[8px] rounded-sm border cursor-pointer ${
                style === 'dashed'
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
              }`}
              title="Пунктир"
            >
              - -
            </button>
            <button
              type="button"
              onClick={(e) => changeStyle('dotted', e)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`nodrag nopan px-0.5 py-px text-[8px] rounded-sm border cursor-pointer ${
                style === 'dotted'
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
              }`}
              title="Точки"
            >
              ··
            </button>
          </div>
        </div>
        <div className="w-full border-t border-slate-600 pt-px mt-px">
          <button
            type="button"
            onClick={deleteEdge}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nopan w-full min-w-0 px-1 py-0.5 text-[10px] rounded border border-red-900/50 bg-red-900/20 text-red-400 hover:text-red-300 cursor-pointer inline-flex items-center justify-center leading-tight"
            title="Удалить линию"
          >
            <span className="pointer-events-none inline-flex"><Trash2 size={12} /></span>
          </button>
        </div>
      </EdgeToolbar>
    </>
  );
}
