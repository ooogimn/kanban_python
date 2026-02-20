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
  /** Текст над узлом (сверху), с автопереносом */
  topText?: string;
  topTextColor?: string;
  topTextFontSize?: number;
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

/** Палитра цветов для узлов и линий: по нарастающему оттенку (hue 0° → 360°), в конце нейтральные */
export const COLOR_PRESETS = [
  { name: 'Красный', value: '#FF0000' },
  { name: 'Коричневый', value: '#A52A2A' },
  { name: 'Оранжевый', value: '#FFA500' },
  { name: 'Жёлтый', value: '#FFFF00' },
  { name: 'Оливковый', value: '#808000' },
  { name: 'Салатовый', value: '#7FFF00' },
  { name: 'Зелёный', value: '#008000' },
  { name: 'Бирюзовый', value: '#00FFFF' },
  { name: 'Синий', value: '#0000FF' },
  { name: 'Индиго', value: '#4B0082' },
  { name: 'Фиолетовый', value: '#800080' },
  { name: 'Малиновый', value: '#DC143C' },
  { name: 'Розовый', value: '#FFC0CB' },
  { name: 'Серый', value: '#808080' },
  { name: 'Чёрный', value: '#000000' },
  { name: 'Белый', value: '#FFFFFF' },
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

/** Размеры надписей (узлы): от мелких до крупных для гибкости */
export const LABEL_FONT_SIZES = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 52] as const;

export const ROTATION_PRESETS = [
  { deg: 0, title: '0°' },
  { deg: -45, title: '-45°' },
  { deg: -90, title: '-90°' },
  { deg: 45, title: '45°' },
  { deg: 90, title: '90°' },
  { deg: 180, title: '180°' },
] as const;
