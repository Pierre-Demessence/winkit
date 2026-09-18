import type { Bounds, Rect, WindowLayerProps } from './types';
import { createContext } from 'preact';
import { useContext, useMemo, useRef } from 'preact/hooks';

export interface WindowLayerContext {
  /** Bring the caller to the front; returns the new z-index to apply. */
  focus: () => number;
  /**
   * Current size of the layer in CSS pixels, or `{ w: 0, h: 0 }` when it cannot
   * be measured yet. Callers must treat zero as "unknown" and skip clamping
   * rather than clamping everything to the origin.
   */
  getBounds: () => Bounds;
  /**
   * The rectangles of every other live window, for snapping. Excludes the
   * caller's own getter and any window that reports `null` (closed or
   * minimized).
   */
  getSnapRects: (exclude: () => Rect | null) => Rect[];
  /**
   * Register a window so its rectangle can be a snap target for its siblings.
   * `getRect` returns the window's current rectangle, or `null` while it is not
   * a valid target. Returns an unregister function.
   */
  registerWindow: (getRect: () => Rect | null) => () => void;
  /**
   * Calls `listener` whenever the layer's size changes, including the first time
   * it becomes measurable (a container that starts hidden). Returns an
   * unsubscribe. A no-op when the observer is unavailable.
   */
  subscribe: (listener: () => void) => () => void;
}

const fallbackContext: WindowLayerContext = {
  focus: () => 1,
  getBounds: () => ({ h: 0, w: 0 }),
  getSnapRects: () => [],
  registerWindow: () => () => {},
  subscribe: () => () => {},
};

const LayerContext = createContext<WindowLayerContext>(fallbackContext);

/**
 * Access the hosting layer. Outside a `WindowLayer` this degrades to a no-op
 * focus and unknown bounds, so windows still render but cannot stack or clamp.
 */
export function useWindowLayer(): WindowLayerContext {
  return useContext(LayerContext);
}

/**
 * Full-viewport container that hosts floating `Window`s and manages their
 * stacking order. Empty areas pass pointer events through to whatever is behind
 * (e.g. a game canvas).
 *
 * The layer is the coordinate space for every hosted window: positions are
 * relative to it and windows are clamped to its measured size. That means
 * confining the layer to a region automatically confines dragging too.
 */
export function WindowLayer({ children, class: className }: WindowLayerProps) {
  const top = useRef(1);
  const element = useRef<HTMLDivElement>(null);
  const windows = useRef(new Set<() => Rect | null>());

  // Stable identity. A fresh context object per render would re-render every
  // hosted window on any unrelated layer render.
  const context = useMemo<WindowLayerContext>(() => ({
    focus: () => {
      top.current += 1;
      return top.current;
    },
    getBounds: () => {
      const rect = element.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0)
        return { h: rect.height, w: rect.width };
      return { h: 0, w: 0 };
    },
    getSnapRects: (exclude) => {
      const rects: Rect[] = [];
      for (const getRect of windows.current) {
        if (getRect === exclude)
          continue;
        const rect = getRect();
        if (rect)
          rects.push(rect);
      }
      return rects;
    },
    registerWindow: (getRect) => {
      windows.current.add(getRect);
      return () => {
        windows.current.delete(getRect);
      };
    },
    subscribe: (listener) => {
      const node = element.current;
      if (!node || typeof ResizeObserver === 'undefined')
        return () => {};
      const observer = new ResizeObserver(() => listener());
      observer.observe(node);
      return () => observer.disconnect();
    },
  }), []);

  return (
    <div ref={element} class={className ? `wk-layer ${className}` : 'wk-layer'}>
      <LayerContext.Provider value={context}>{children}</LayerContext.Provider>
    </div>
  );
}
