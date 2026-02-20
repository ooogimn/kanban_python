import { useRef, useState } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Diamond,
  ExternalLink,
  Hexagon,
  ImageIcon,
  Square,
  Trash2,
  Triangle,
} from 'lucide-react';
import type { Edge, Node } from '@xyflow/react';
import {
  COLOR_PRESETS,
  DEFAULT_LABEL_COLOR,
  DEFAULT_LABEL_FONT_SIZE,
  LABEL_FONT_SIZES,
  ROTATION_PRESETS,
  type CyberNodeData,
  type ShapeType,
} from './nodeConfig';
import type { CyberEdgeData, EdgeLabelWrapperSize, EdgeStyleType } from './CyberEdge';

const EDGE_DEFAULT_COLOR = '#22d3ee';
const EDGE_DEFAULT_LABEL_FONT_SIZE = 12;
/** Размеры надписей на линии: 4, 6, 8 и популярные значения */
const EDGE_FONT_SIZES = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32] as const;
const EDGE_STROKE_WIDTHS = [2, 4, 6, 8, 10, 12] as const;
const EDGE_WRAPPER_SIZES: { value: EdgeLabelWrapperSize; label: string }[] = [
  { value: 'small', label: 'Маленькая' },
  { value: 'medium', label: 'Средняя' },
  { value: 'large', label: 'Большая' },
];

type EdgeColorTarget = 'label' | 'line' | 'wrapper';
const EDGE_COLOR_TARGETS: { value: EdgeColorTarget; label: string }[] = [
  { value: 'label', label: 'Надпись' },
  { value: 'line', label: 'Линия' },
  { value: 'wrapper', label: 'Обёртка' },
];

type NodeColorTarget = 'wrapper' | 'card' | 'label' | 'topText' | 'bottomText' | 'border';
const NODE_COLOR_TARGETS: { value: NodeColorTarget; label: string }[] = [
  { value: 'wrapper', label: 'Обёртка' },
  { value: 'card', label: 'Карточка' },
  { value: 'label', label: 'Надпись' },
  { value: 'topText', label: 'Текст сверху' },
  { value: 'bottomText', label: 'Текст снизу' },
  { value: 'border', label: 'Рамка' },
];

type NodeSizeTarget = 'label' | 'topText' | 'bottomText' | 'link';
const NODE_SIZE_TARGETS: { value: NodeSizeTarget; label: string }[] = [
  { value: 'label', label: 'Надпись' },
  { value: 'topText', label: 'Текст сверху' },
  { value: 'bottomText', label: 'Текст снизу' },
  { value: 'link', label: 'URL' },
];
/** Только надпись и текст снизу для блока «Размер» в сайдбаре узла */
const NODE_FONT_SIZE_TARGETS = NODE_SIZE_TARGETS.filter((t) => t.value !== 'link');

export default function NodeSettingsSidebar() {
  const selectedNode = useStore((s) => s.nodes.find((n) => n.selected)) as Node<CyberNodeData> | undefined;
  const selectedEdge = useStore((s) => s.edges.find((e) => e.selected)) as Edge<CyberEdgeData> | undefined;
  const { updateNodeData, updateEdgeData, deleteElements } = useReactFlow();
  const [collapsed, setCollapsed] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageInputValue, setImageInputValue] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [edgeColorTarget, setEdgeColorTarget] = useState<EdgeColorTarget>('line');
  const [nodeColorTarget, setNodeColorTarget] = useState<NodeColorTarget>('card');
  const [nodeSizeTarget, setNodeSizeTarget] = useState<NodeSizeTarget>('label');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (collapsed) {
    return (
      <div className="absolute right-0 top-0 z-10 h-full w-10 border-l border-slate-600 bg-slate-800/95 flex flex-col items-center pt-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="p-1.5 text-slate-400 hover:text-white rounded border border-slate-600 hover:bg-slate-700"
          title="Развернуть панель"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
    );
  }

  const hasSelection = selectedNode || selectedEdge;

  if (!hasSelection) {
    return (
      <div className="absolute right-0 top-0 z-10 h-full w-64 border-l border-slate-600 bg-slate-800/95 flex flex-col">
        <div className="flex items-center justify-between p-2 border-b border-slate-600">
          <span className="text-xs font-medium text-slate-400">Настройки</span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 text-slate-400 hover:text-white rounded"
            title="Свернуть"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="p-4 flex-1 flex items-center justify-center text-slate-500 text-sm text-center">
          Выберите узел или линию для настройки
        </div>
      </div>
    );
  }

  if (selectedEdge) {
    const edgeId = selectedEdge.id;
    const data = selectedEdge.data ?? {};
    const updateEdge = (patch: Partial<CyberEdgeData>) => updateEdgeData(edgeId, patch);
    const style = (data.style ?? 'solid') as EdgeStyleType;
    const color = data.color ?? EDGE_DEFAULT_COLOR;
    const strokeWidth = data.strokeWidth ?? 2;
    const label = data.label ?? '';
    const labelColor = data.labelColor ?? DEFAULT_LABEL_COLOR;
    const labelFontSize = data.labelFontSize ?? EDGE_DEFAULT_LABEL_FONT_SIZE;
    const labelRotation = data.labelRotation ?? 0;
    const labelWrapperColor = data.labelWrapperColor ?? 'rgb(30 41 59)';
    const labelWrapperSize = (data.labelWrapperSize ?? 'medium') as EdgeLabelWrapperSize;

    return (
      <div className="absolute right-0 top-0 z-10 h-full w-64 overflow-y-auto border-l border-slate-600 bg-slate-800/95 flex flex-col">
        <div className="flex items-center justify-between p-2 border-b border-slate-600 shrink-0">
          <span className="text-xs font-medium text-slate-400">Настройки линии</span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 text-slate-400 hover:text-white rounded"
            title="Свернуть"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="p-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Надпись на линии:</span>
            <input
              type="text"
              value={label}
              onChange={(e) => updateEdge({ label: e.target.value })}
              placeholder="Введите текст..."
              className="w-full px-2 py-1 text-sm rounded bg-slate-700 text-slate-100 border border-slate-600 outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Размеры надписей:</span>
            <div className="flex gap-0.5 flex-wrap">
              {EDGE_FONT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => updateEdge({ labelFontSize: size })}
                  className={`px-1.5 py-0.5 text-xs rounded border cursor-pointer ${labelFontSize === size ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Поворот надписи:</span>
            <div className="flex gap-0.5 flex-wrap">
              {ROTATION_PRESETS.map(({ deg, title }) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => updateEdge({ labelRotation: deg })}
                  className={`px-1.5 py-0.5 text-xs rounded border cursor-pointer ${labelRotation === deg ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {title}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Стиль линии:</span>
            <div className="flex gap-1 flex-wrap">
              {(['solid', 'dashed', 'dotted'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateEdge({ style: s })}
                  className={`px-2 py-1 text-xs rounded border cursor-pointer ${style === s ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                  title={s === 'solid' ? 'Сплошная' : s === 'dashed' ? 'Пунктир' : 'Точки'}
                >
                  {s === 'solid' ? '—' : s === 'dashed' ? '- -' : '··'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Цвет:</span>
            <div className="flex gap-0.5 flex-wrap mb-1">
              {EDGE_COLOR_TARGETS.map(({ value: v, label: l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEdgeColorTarget(v)}
                  className={`px-1.5 py-0.5 text-xs rounded border cursor-pointer ${edgeColorTarget === v ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {COLOR_PRESETS.map(({ value }) => {
                const patch = edgeColorTarget === 'label' ? { labelColor: value } : edgeColorTarget === 'line' ? { color: value } : { labelWrapperColor: value };
                const current = edgeColorTarget === 'label' ? labelColor : edgeColorTarget === 'line' ? color : labelWrapperColor;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateEdge(patch)}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer hover:scale-110 ${current === value ? 'border-white ring-1 ring-white' : 'border-slate-600'
                      }`}
                    style={{ backgroundColor: value }}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Толщина линии:</span>
            <div className="flex gap-0.5 flex-wrap">
              {EDGE_STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => updateEdge({ strokeWidth: w })}
                  className={`px-1.5 py-0.5 text-xs rounded border cursor-pointer ${strokeWidth === w ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Размер обёртки:</span>
            <div className="flex gap-0.5 flex-wrap">
              {EDGE_WRAPPER_SIZES.map(({ value: v, label: l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateEdge({ labelWrapperSize: v })}
                  className={`px-1.5 py-0.5 text-xs rounded border cursor-pointer ${labelWrapperSize === v ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-600 pt-2">
            <button
              type="button"
              onClick={() => deleteElements({ edges: [{ id: edgeId }] })}
              className="w-full px-2 py-1 text-xs rounded border border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 cursor-pointer inline-flex items-center justify-center gap-1"
              title="Удалить линию"
            >
              <Trash2 size={14} />
              Удалить линию
            </button>
          </div>
        </div>
      </div>
    );
  }

  const id = selectedNode.id;
  const data = selectedNode.data ?? {};
  const update = (patch: Partial<CyberNodeData>) => updateNodeData(id, patch);

  const color = data.color;
  const wrapperEnabled = data.wrapperEnabled !== false;
  const cardColor = data.cardColor;
  const labelColor = data.labelColor ?? DEFAULT_LABEL_COLOR;
  const borderColor = data.borderColor;
  const topText = data.topText ?? '';
  const topTextColor = data.topTextColor ?? DEFAULT_LABEL_COLOR;
  const topTextFontSize = data.topTextFontSize ?? 12;
  const bottomText = data.bottomText ?? '';
  const bottomTextColor = data.bottomTextColor ?? DEFAULT_LABEL_COLOR;
  const linkUrl = data.link;
  const shape = data.shape ?? 'rectangle';
  const rotation = data.rotation ?? 0;
  const labelFontSize = data.labelFontSize ?? DEFAULT_LABEL_FONT_SIZE;
  const bottomTextFontSize = data.bottomTextFontSize ?? 12;
  const linkFontSize = data.linkFontSize ?? 14;

  const submitImageUrl = () => {
    const url = imageInputValue.trim();
    if (url) update({ image: url });
    setShowImageInput(false);
  };
  const submitLinkUrl = () => {
    update({ link: linkInputValue.trim() || undefined });
    setShowLinkInput(false);
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      update({ image: reader.result as string });
      setShowImageInput(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="absolute right-0 top-0 z-10 h-full w-64 overflow-y-auto border-l border-slate-600 bg-slate-800/95 flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-slate-600 shrink-0">
        <span className="text-xs font-medium text-slate-400">Настройки узла</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="p-1 text-slate-400 hover:text-white rounded"
          title="Свернуть"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Обёртка:</span>
          <button
            type="button"
            onClick={() => update({ wrapperEnabled: !wrapperEnabled })}
            className={`w-full px-2 py-1 text-xs rounded border cursor-pointer text-left ${wrapperEnabled ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'
              }`}
          >
            {wrapperEnabled ? 'Вкл' : 'Выкл'}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Цвет:</span>
          <div className="flex gap-0.5 flex-wrap mb-1">
            {NODE_COLOR_TARGETS.map(({ value: v, label: l }) => (
              <button
                key={v}
                type="button"
                onClick={() => setNodeColorTarget(v)}
                className={`px-1.5 py-0.5 text-xs rounded border cursor-pointer ${nodeColorTarget === v ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  }`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {COLOR_PRESETS.map(({ value }) => {
              const patch =
                nodeColorTarget === 'wrapper' ? { color: value }
                  : nodeColorTarget === 'card' ? { cardColor: value }
                    : nodeColorTarget === 'label' ? { labelColor: value }
                      : nodeColorTarget === 'topText' ? { topTextColor: value }
                        : nodeColorTarget === 'bottomText' ? { bottomTextColor: value }
                          : { borderColor: value };
              const current =
                nodeColorTarget === 'wrapper' ? color
                  : nodeColorTarget === 'card' ? cardColor
                    : nodeColorTarget === 'label' ? labelColor
                      : nodeColorTarget === 'topText' ? topTextColor
                        : nodeColorTarget === 'bottomText' ? bottomTextColor
                          : borderColor;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => update(patch)}
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer hover:scale-110 ${current === value ? 'border-white ring-1 ring-white' : 'border-slate-600'
                    }`}
                  style={{ backgroundColor: value }}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Текст (сверху):</span>
          <textarea
            value={topText}
            onChange={(e) => update({ topText: e.target.value })}
            placeholder="Текст над узлом"
            rows={2}
            className="w-full px-2 py-1 text-sm rounded bg-slate-700 text-slate-100 border border-slate-600 outline-none focus:border-cyan-400 resize-y min-h-[2.5rem]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Текст (снизу):</span>
          <textarea
            value={bottomText}
            onChange={(e) => update({ bottomText: e.target.value })}
            placeholder="Текст под узлом"
            rows={2}
            className="w-full px-2 py-1 text-sm rounded bg-slate-700 text-slate-100 border border-slate-600 outline-none focus:border-cyan-400 resize-y min-h-[2.5rem]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Картинка:</span>
          {showImageInput ? (
            <div className="flex flex-col gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileUpload}
                className="hidden"
                aria-hidden
              />
              <input
                type="url"
                value={imageInputValue}
                onChange={(e) => setImageInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitImageUrl();
                  if (e.key === 'Escape') setShowImageInput(false);
                }}
                placeholder="URL картинки"
                className="w-full px-2 py-1 text-sm rounded bg-slate-700 text-slate-100 border border-slate-600 outline-none focus:border-cyan-400"
                autoFocus
              />
              <div className="flex gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={submitImageUrl}
                  className="px-2 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  Вставить
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-200"
                >
                  Файл
                </button>
                <button
                  type="button"
                  onClick={() => setShowImageInput(false)}
                  className="px-2 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-200"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setImageInputValue(data.image ?? '');
                setShowImageInput(true);
              }}
              className="p-1.5 text-slate-300 hover:text-white cursor-pointer inline-flex rounded border border-slate-600 hover:bg-slate-700 w-fit"
              title="Добавить картинку"
            >
              <ImageIcon size={18} />
            </button>
          )}
          {data.image && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-xs text-slate-400">Размер изображения:</span>
              <div className="flex flex-wrap gap-1">
                {[50, 75, 100, 125, 150].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => update({ imageSize: pct })}
                    className={`px-2 py-1 text-xs rounded ${(data.imageSize ?? 100) === pct
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                      }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Ссылка:</span>
          {showLinkInput ? (
            <div className="flex flex-col gap-1">
              <input
                type="url"
                value={linkInputValue}
                onChange={(e) => setLinkInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitLinkUrl();
                  if (e.key === 'Escape') setShowLinkInput(false);
                }}
                placeholder="https://..."
                className="w-full px-2 py-1 text-sm rounded bg-slate-700 text-slate-100 border border-slate-600 outline-none focus:border-cyan-400"
                autoFocus
              />
              <div className="flex gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={submitLinkUrl}
                  className="px-2 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => { update({ link: undefined }); setShowLinkInput(false); }}
                  className="px-2 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-200"
                >
                  Удалить
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkInput(false)}
                  className="px-2 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-200"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLinkInputValue(linkUrl ?? '');
                setShowLinkInput(true);
              }}
              className="p-1.5 text-slate-300 hover:text-white cursor-pointer inline-flex rounded border border-slate-600 hover:bg-slate-700 w-fit"
              title={linkUrl ? `Ссылка: ${linkUrl}` : 'Добавить ссылку'}
            >
              <ExternalLink size={18} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Размеры надписей:</span>
          <div className="flex gap-0.5 flex-wrap mb-1">
            {NODE_FONT_SIZE_TARGETS.map(({ value: v, label: l }) => (
              <button
                key={v}
                type="button"
                onClick={() => setNodeSizeTarget(v)}
                className={`px-1.5 py-0.5 text-xs rounded border cursor-pointer ${nodeSizeTarget === v ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  }`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 flex-wrap">
            {LABEL_FONT_SIZES.map((size) => {
              const patch = nodeSizeTarget === 'label' ? { labelFontSize: size }
                : nodeSizeTarget === 'topText' ? { topTextFontSize: size }
                  : { bottomTextFontSize: size };
              const current = nodeSizeTarget === 'label' ? labelFontSize
                : nodeSizeTarget === 'topText' ? topTextFontSize
                  : bottomTextFontSize;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => update(patch)}
                  className={`px-1.5 py-0.5 text-xs rounded border cursor-pointer ${current === size ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Поворот:</span>
          <div className="flex gap-0.5 flex-wrap">
            {ROTATION_PRESETS.map(({ deg, title }) => (
              <button
                key={deg}
                type="button"
                onClick={() => update({ rotation: deg })}
                className={`px-1.5 py-0.5 text-xs rounded border cursor-pointer ${rotation === deg ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  }`}
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Форма:</span>
          <div className="flex gap-0.5 flex-wrap">
            {(
              [
                { shape: 'rectangle' as ShapeType, Icon: Square, title: 'Прямоугольник' },
                { shape: 'circle', Icon: Circle, title: 'Круг' },
                { shape: 'diamond', Icon: Diamond, title: 'Ромб' },
                { shape: 'hexagon', Icon: Hexagon, title: 'Шестиугольник' },
                { shape: 'triangle', Icon: Triangle, title: 'Треугольник' },
              ] as const
            ).map(({ shape: s, Icon, title }) => (
              <button
                key={s}
                type="button"
                onClick={() => update({ shape: s })}
                className={`p-1 rounded cursor-pointer inline-flex ${shape === s ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white bg-slate-700 border border-slate-600'
                  } ${s === 'diamond' ? '[&_svg]:rotate-45' : ''}`}
                title={title}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
