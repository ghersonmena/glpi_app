import { useRef, useState } from 'react';
import type React from 'react';

// Navegación entre módulos deslizando el dedo a izquierda/derecha sobre el contenido.
// El contenido sigue al dedo; al soltar, si se deslizó lo suficiente cambia de módulo con
// animación, y si no, regresa a su lugar.

const AXIS_LOCK_PX = 10;        // movimiento mínimo para decidir si el gesto es horizontal o vertical
const SWIPE_RATIO = 0.25;       // fracción del ancho a deslizar para cambiar de módulo
const FLICK_VELOCITY = 0.5;     // px/ms: un deslizamiento rápido cuenta aunque sea corto
const FLICK_MIN_PX = 40;
const EDGE_RESISTANCE = 0.25;   // en el primer/último módulo el contenido se resiste a moverse

export type SlideDirection = 'next' | 'prev' | null;

interface Options {
  enabled: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

// No iniciar el gesto sobre campos de texto ni sobre elementos que ya se desplazan en horizontal
const startsOnHorizontalScroller = (target: EventTarget | null, root: HTMLElement): boolean => {
  let el = target as HTMLElement | null;
  while (el && el !== root) {
    if (el.matches?.('input, textarea, select, [data-no-swipe]')) return true;
    const overflowX = window.getComputedStyle(el).overflowX;
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2) return true;
    el = el.parentElement;
  }
  return false;
};

export const useSwipeNavigation = ({ enabled, hasPrev, hasNext, onPrev, onNext }: Options) => {
  const start = useRef<{ x: number; y: number; time: number } | null>(null);
  const axis = useRef<'x' | 'y' | null>(null);
  const [dragX, setDragX] = useState<number>(0);
  const [snapping, setSnapping] = useState<boolean>(false);

  const reset = () => {
    start.current = null;
    axis.current = null;
  };

  const onTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (!enabled || e.touches.length !== 1 || startsOnHorizontalScroller(e.target, e.currentTarget)) {
      reset();
      return;
    }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    axis.current = null;
    setSnapping(false);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (!start.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;

    if (!axis.current) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      axis.current = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
    }
    if (axis.current !== 'x') return; // gesto vertical: dejar que la página haga scroll

    const blocked = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
    setDragX(blocked ? dx * EDGE_RESISTANCE : dx);
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (!start.current || axis.current !== 'x') {
      reset();
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const elapsed = Math.max(1, Date.now() - start.current.time);
    const width = e.currentTarget.clientWidth || window.innerWidth;
    const passed = Math.abs(dx) > width * SWIPE_RATIO
      || (Math.abs(dx) > FLICK_MIN_PX && Math.abs(dx) / elapsed > FLICK_VELOCITY);
    reset();

    if (passed && dx < 0 && hasNext) {
      setDragX(0);
      onNext();
    } else if (passed && dx > 0 && hasPrev) {
      setDragX(0);
      onPrev();
    } else {
      // No alcanzó: regresar a su lugar con transición
      setSnapping(true);
      setDragX(0);
    }
  };

  const contentStyle: React.CSSProperties = dragX !== 0 || snapping
    ? { transform: `translateX(${dragX}px)`, transition: snapping ? 'transform 0.2s ease-out' : 'none' }
    : {};

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
    contentStyle
  };
};
