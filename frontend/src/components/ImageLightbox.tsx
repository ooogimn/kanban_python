/**
 * Модальное окно просмотра изображения с зумом и перетаскиванием.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const STEP = 0.25;

export default function ImageLightbox({ src, alt = '', onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s + STEP));
  }, []);
  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s - STEP));
  }, []);
  const reset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    },
    [zoomIn, zoomOut]
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: dragStart.current.posX + e.clientX - dragStart.current.x,
        y: dragStart.current.posY + e.clientY - dragStart.current.y,
      });
    },
    [isDragging]
  );

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, onMouseMove, onMouseUp]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
    >
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden flex items-center justify-center"
        onWheel={onWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="select-none max-w-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          onMouseDown={onMouseDown}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={zoomIn}
          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
          title="Увеличить"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
          title="Уменьшить"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={reset}
          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
          title="Сбросить"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
          title="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
