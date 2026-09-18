import type { ComponentChildren } from 'preact';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Size of the region a layer occupies, in CSS pixels. */
export interface Bounds {
  h: number;
  w: number;
}

/** A window's rectangle in layer coordinates, used as a snap target. */
export interface Rect {
  h: number;
  w: number;
  x: number;
  y: number;
}

/**
 * Which edges a resize gesture moves. An absent axis stays anchored; `w`/`n`
 * move the window's origin as they resize, `e`/`s` grow from a fixed origin.
 */
export interface ResizeEdges {
  x?: 'e' | 'w';
  y?: 'n' | 's';
}

/**
 * Minimal key/value storage, so window layout persistence can be routed
 * anywhere (localStorage, a shared save blob, an in-memory stub in tests).
 */
export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** Persisted window layout. Every field is optional and re-validated on read. */
export interface SavedLayout {
  minimized?: boolean;
  pos?: Point;
  size?: Size;
}

/** A window's current committed layout, as reported to `onLayoutChange`. */
export interface WindowLayout {
  minimized: boolean;
  pos: Point;
  size: Size;
}

export interface WindowLayerProps {
  /**
   * Extra class on the layer element. By default the layer covers the viewport;
   * to confine it — and every window's draggable area — to a region, give the
   * parent `position: relative` and pass a compound selector so it wins on
   * specificity, e.g. `.wk-layer.guild-hall-layer { position: absolute; }`.
   */
  class?: string;
  children?: ComponentChildren;
}

export interface WindowProps {
  /** Title-bar text, and the window's accessible name. */
  title: string;
  /**
   * Parent-controlled visibility. When false the window renders nothing but
   * stays mounted, so its layout state (position/size/minimized) is kept.
   */
  open: boolean;
  /** Initial top-left, used when no persisted layout exists. */
  defaultPosition?: Point;
  /** Initial size, used when no persisted layout exists. */
  defaultSize?: Size;
  /** Minimum size while resizing. */
  minSize?: Size;
  /**
   * Align this window's edges to the layer edges and to other windows while
   * dragging or resizing, snapping when an edge comes within a few pixels.
   * Off by default. A window is a snap *target* for others regardless of this
   * flag; the flag only controls whether *this* window snaps.
   */
  snap?: boolean;
  /**
   * Key for layout persistence; when set, position/size/minimized persist
   * across reloads. Reopening a window that was closed shows it restored (not
   * minimized).
   */
  persistKey?: string;
  /**
   * Where the layout is persisted. Defaults to `localStorage`. Must be a
   * referentially stable object (a module-level singleton or memoized).
   */
  storage?: StorageLike;
  /** Enables the close button and the Escape shortcut. */
  onClose?: () => void;
  /**
   * Observe the window's moves, resizes and minimize toggles. Fires on each
   * drag move, resize step and minimize toggle — once per pointer move during a
   * gesture. It never fires for the initial mount or an automatic re-clamp
   * (a viewport or monitor change), only for a change the host's user caused.
   * Debounce inside the handler if you want fewer calls.
   */
  onLayoutChange?: (layout: WindowLayout) => void;
  children?: ComponentChildren;
}
