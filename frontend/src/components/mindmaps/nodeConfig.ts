/** Общие константы и типы для узла Mind Map (CyberNode и NodeSettingsSidebar). */

export type ShapeType = 'rectangle' | 'circle' | 'diamond' | 'hexagon' | 'triangle' | 'oval' | 'cloud';

export type CyberNodeData = {
  label?: string;
  color?: string;
  wrapperEnabled?: boolean;
  cardColor?: string;
  image?: string;
  /** Масштаб изображения в карточке (%), 50–150 */
  imageSize?: number;
  link?: string;
  shape?: ShapeType;
  rotation?: number;
  width?: number;
  height?: number;
  labelFontSize?: number;
  labelColor?: string;
  bottomText?: string;
  /** Цвет текста снизу */
  bottomTextColor?: string;
  /** Размер шрифта текста снизу (px) */
  bottomTextFontSize?: number;
  /** Размер иконки/шрифта ссылки (px) */
  linkFontSize?: number;
  collapsed?: boolean;
  /** Цвет рамки узла (неоновое свечение). Если не задан — выбран: фиолетовый, не выбран: зелёный */
  borderColor?: string;
  /** При перетаскивании двигать и всех потомков (ветку). По умолчанию true */
  dragWithChildren?: boolean;
};

export const COLOR_PRESETS = [
  { name: 'Cyan', value: '#22d3ee' },
  { name: 'Pink', value: '#f472b6' },
  { name: 'Lime', value: '#a3e635' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Violet', value: '#a78bfa' },
  { name: 'Красный', value: '#ef4444' },
  { name: 'Белый', value: '#e2e8f0' },
  { name: 'Серый', value: 'rgb(71 85 105)' },
] as const;

export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 80;
export const DEFAULT_LABEL_FONT_SIZE = 10;
export const DEFAULT_LABEL_COLOR = '#e2e8f0';
export const CARD_BG_DEFAULT = '#0f172a';

export const NODE_SIZE_PRESETS = [
  { w: 120, h: 56, title: 'S' },
  { w: 160, h: 72, title: 'M' },
  { w: 200, h: 88, title: 'L' },
  { w: 260, h: 100, title: 'XL' },
  { w: 320, h: 120, title: 'XXL' },
  { w: 400, h: 150, title: '3XL' },
  { w: 500, h: 180, title: '4XL' },
] as const;

export const LABEL_FONT_SIZES = [10, 14, 18, 24, 36, 48, 52] as const;

export const ROTATION_PRESETS = [
  { deg: 0, title: '0°' },
  { deg: -45, title: '-45°' },
  { deg: -90, title: '-90°' },
  { deg: 45, title: '45°' },
  { deg: 90, title: '90°' },
  { deg: 180, title: '180°' },
] as const;
