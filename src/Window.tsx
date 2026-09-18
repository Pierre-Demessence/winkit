import type { Point, Rect, ResizeEdges, Size, StorageLike, WindowLayout, WindowProps } from './types';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import { clampPosition, clampSize, DEFAULT_MIN, DEFAULT_POS, DEFAULT_SIZE, readSavedLayout, resizeRect, snapLines, snapPosition, snapResizeDelta, toPoint, toSize, writeSavedLayout } from './layout';
import { useWindowLayer } from './WindowLayer';

/** Debounce for writing layout to storage, so a drag is one write, not hundreds. */
const SAVE_DEBOUNCE_MS = 300;

/** How near, in CSS pixels, an edge must come to a snap line before it jumps. */
const SNAP_THRESHOLD = 8;

/**
 * The eight resize handles, in DOM order. Corners come after edges so they paint
 * on top and win the overlap at each corner.
 */
const RESIZE_HANDLES: { edges: ResizeEdges; name: string }[] = [
  { edges: { y: 'n' }, name: 'n' },
  { edges: { y: 's' }, name: 's' },
  { edges: { x: 'e' }, name: 'e' },
  { edges: { x: 'w' }, name: 'w' },
  { edges: { x: 'e', y: 'n' }, name: 'ne' },
  { edges: { x: 'w', y: 'n' }, name: 'nw' },
  { edges: { x: 'e', y: 's' }, name: 'se' },
  { edges: { x: 'w', y: 's' }, name: 'sw' },
];

/**
 * Monotonic per-document counter for the title's id. `useId` is per Preact root,
 * so two roots in one document would collide; this cannot.
 */
let instanceSequence = 0;

const defaultStorage: StorageLike = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

/**
 * A floating, draggable, resizable panel. Self-manages position / size /
 * minimized; visibility is controlled by the parent via `open`. With a
 * `persistKey`, layout survives reloads and open/close toggles.
 */
export function Window(props: WindowProps) {
  const { children, defaultPosition, defaultSize, minSize, onClose, onLayoutChange, open, persistKey, snap, storage: storageProp, title } = props;
  const layer = useWindowLayer();

  // Props are as untrusted as storage — a `NaN` would reach a CSS value.
  const minFloor = toSize(minSize) ?? DEFAULT_MIN;

  // Capture storage once so its identity is stable: the persist effects depend
  // on it not changing between renders.
  const [storage] = useState(() => storageProp ?? defaultStorage);
  const [restored] = useState(() => (persistKey ? readSavedLayout(storage, persistKey) : undefined));

  const [pos, setPos] = useState<Point>(restored?.pos ?? toPoint(defaultPosition) ?? DEFAULT_POS);
  const [size, setSize] = useState<Size>(restored?.size ?? toSize(defaultSize) ?? DEFAULT_SIZE);
  const [minimized, setMinimized] = useState<boolean>(restored?.minimized ?? false);
  // Start above whatever is already mounted. A window that mounts *already open*
  // never fires the open transition below, so without this a freshly opened window
  // would start at the bottom of the stack and appear behind windows the user has
  // already clicked — the one window they just asked for being the hidden one.
  // Safe during render: Preact invokes a state initialiser exactly once and does not
  // double-render (its StrictMode is a pass-through), and the worst case of a render
  // that never commits is a skipped number, which nothing observes.
  const [z, setZ] = useState(() => layer.focus());

  const windowRef = useRef<HTMLDivElement>(null);
  const [titleId] = useState(() => `wk-title-${++instanceSequence}`);

  // Latest committed layout, so the fit / persist / unmount effects never read a
  // stale closure.
  const latest = useRef({ minimized, open, pos, size });
  latest.current = { minimized, open, pos, size };

  // Register this window as a snap target. A closed or minimized window reports
  // `null`, so it is never something another window snaps to. The getter is
  // stable and reads the live layout, so the layer needs no move notifications.
  const getSnapRect = useCallback((): Rect | null => {
    const current = latest.current;
    if (!current.open || current.minimized)
      return null;
    return { h: current.size.h, w: current.size.w, x: current.pos.x, y: current.pos.y };
  }, []);
  useEffect(() => layer.registerWindow(getSnapRect), [layer, getSnapRect]);

  /**
   * Raise the window, and take focus when it is not already inside — so clicking
   * a window makes its Escape shortcut reachable without stealing focus from a
   * control the user just clicked.
   */
  const bringToFront = useCallback((): void => {
    setZ(layer.focus());
    const element = windowRef.current;
    if (element && !element.contains(document.activeElement))
      element.focus();
  }, [layer]);

  /**
   * Fit into the layer as soon as it is measurable, and re-fit whenever the
   * layer changes size — a viewport resize, a monitor change, a region reflow,
   * or a container becoming visible for the first time. This is what stops a
   * persisted window being restored off-screen and unreachable.
   */
  useEffect(() => {
    const fit = (): void => {
      const bounds = layer.getBounds();
      if (bounds.w <= 0 || bounds.h <= 0)
        return;

      const current = latest.current;

      const nextSize = clampSize(current.size, minFloor, bounds);
      if (nextSize.w !== current.size.w || nextSize.h !== current.size.h)
        setSize(nextSize);

      const nextPos = clampPosition(current.pos, nextSize, bounds);
      if (nextPos.x !== current.pos.x || nextPos.y !== current.pos.y)
        setPos(nextPos);
    };

    fit();
    window.addEventListener('resize', fit);
    const unsubscribe = layer.subscribe(fit);
    return () => {
      window.removeEventListener('resize', fit);
      unsubscribe();
    };
  }, [layer, minFloor.h, minFloor.w]);

  // Persist on a debounce.
  useEffect(() => {
    if (!persistKey)
      return;
    const timer = setTimeout(writeSavedLayout, SAVE_DEBOUNCE_MS, storage, persistKey, { minimized, pos, size });
    return () => clearTimeout(timer);
  }, [persistKey, storage, minimized, pos, size]);

  // Flush on unmount so a quick move-then-close is not lost by the debounce.
  useEffect(() => {
    return () => {
      if (persistKey)
        writeSavedLayout(storage, persistKey, latest.current);
    };
  }, [persistKey, storage]);

  // Report layout changes to the host. Fired imperatively from the user actions
  // that move, resize or minimize the window — never from a mount-time or
  // viewport re-clamp, which would surprise a host with a change it did not
  // cause. The callback lives in a ref so a gesture in flight always sees the
  // latest handler.
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;
  const reportLayout = (layout: WindowLayout): void => {
    onLayoutChangeRef.current?.(layout);
  };

  // Reopening a closed window restores and raises it; a reopened window that
  // kept its old z-index could reappear underneath newer ones. Relies on the
  // window staying mounted while closed, so the transition is observable — a
  // fresh page load is not a transition, so a window closed-minimized stays so.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setMinimized(false);
      bringToFront();
    }
    wasOpen.current = open;
  }, [open, bringToFront]);

  /**
   * In-flight gestures, keyed by pointer. A map rather than a single slot so a
   * second pointer cannot orphan the first gesture's cleanup, and so unmounting
   * releases every one of them.
   */
  const gestures = useRef(new Map<number, () => void>());
  useEffect(() => {
    const pending = gestures.current;
    return () => {
      for (const release of pending.values()) release();
      pending.clear();
    };
  }, []);

  /**
   * Runs a pointer gesture to completion. Pointer capture keeps moves flowing
   * when the pointer leaves the page; the window listeners are the transport and
   * the guaranteed cleanup, so no listener outlives the gesture.
   *
   * The capture target is passed in rather than read from `event.currentTarget`
   * (which would also work — Preact attaches the listener to the element carrying
   * the handler) so this helper depends on nothing about how the event was wired
   * up.
   */
  const beginGesture = (
    event: PointerEvent,
    target: HTMLElement | null,
    onMove: (move: PointerEvent) => void,
  ): void => {
    event.preventDefault();

    const pointerId = event.pointerId;
    const captured = target && typeof target.setPointerCapture === 'function' ? target : null;
    captured?.setPointerCapture(pointerId);

    // Only this pointer drives this gesture: a second finger must not move, or
    // end, a drag it did not start.
    const move = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId === pointerId)
        onMove(moveEvent);
    };

    function release(): void {
      if (captured?.hasPointerCapture(pointerId))
        captured.releasePointerCapture(pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      gestures.current.delete(pointerId);
    }

    function end(endEvent: PointerEvent): void {
      if (endEvent.pointerId === pointerId)
        release();
    }

    // Defensive: never hold a stale entry for a pointer that is already tracking.
    gestures.current.get(pointerId)?.();

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    gestures.current.set(pointerId, release);
  };

  /**
   * Shared preamble for the drag and resize gestures: raise the window, keep the
   * press from reaching the layer, then report pointer deltas from the press
   * point until release. The capture target is the element carrying the handler.
   */
  const followPointer = (event: PointerEvent, onDelta: (delta: Point) => void): void => {
    bringToFront();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;

    beginGesture(event, event.currentTarget as HTMLElement | null, (move) => {
      onDelta({ x: move.clientX - startX, y: move.clientY - startY });
    });
  };

  const startDrag = (event: PointerEvent): void => {
    if (event.button !== 0)
      return;
    // The minimize/close buttons sit inside the title bar, so a press on one of
    // them bubbles here and must not begin a drag.
    if (event.target instanceof Element && event.target.closest('button'))
      return;

    const origin = latest.current.pos;
    followPointer(event, (delta) => {
      const requested = { x: origin.x + delta.x, y: origin.y + delta.y };
      const bounds = layer.getBounds();
      const measurable = bounds.w > 0 && bounds.h > 0;
      if (!measurable) {
        const nextPos = { x: Math.max(0, requested.x), y: Math.max(0, requested.y) };
        setPos(nextPos);
        reportLayout({ minimized: latest.current.minimized, pos: nextPos, size: latest.current.size });
        return;
      }

      const snapped = snap
        ? snapPosition(requested, latest.current.size, snapLines(bounds, layer.getSnapRects(getSnapRect)), SNAP_THRESHOLD)
        : requested;
      const nextPos = clampPosition(snapped, latest.current.size, bounds);
      setPos(nextPos);
      reportLayout({ minimized: latest.current.minimized, pos: nextPos, size: latest.current.size });
    });
  };

  const startResize = (edges: ResizeEdges) => (event: PointerEvent): void => {
    if (event.button !== 0)
      return;

    const origin = { pos: latest.current.pos, size: latest.current.size };
    followPointer(event, (delta) => {
      const bounds = layer.getBounds();
      const measurable = bounds.w > 0 && bounds.h > 0;

      const snappedDelta = snap && measurable
        ? snapResizeDelta(origin, edges, delta, snapLines(bounds, layer.getSnapRects(getSnapRect)), SNAP_THRESHOLD)
        : delta;
      const next = resizeRect(origin, edges, snappedDelta, minFloor, measurable ? bounds : undefined);
      setSize(next.size);
      // Only the west/north edges move the origin; the others leave it untouched.
      if (next.pos.x !== latest.current.pos.x || next.pos.y !== latest.current.pos.y)
        setPos(next.pos);
      reportLayout({ minimized: latest.current.minimized, pos: next.pos, size: next.size });
    });
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !onClose)
      return;
    event.stopPropagation();
    onClose();
  };

  if (!open)
    return null;

  return (
    <div
      ref={windowRef}
      aria-labelledby={titleId}
      class="wk-window"
      role="dialog"
      style={{
        height: minimized ? undefined : `${size.h}px`,
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.w}px`,
        zIndex: z,
      }}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onPointerDown={bringToFront}
    >
      <div class="wk-title" onPointerDown={startDrag}>
        <span id={titleId} class="wk-title-text">{title}</span>
        <button
          type="button"
          aria-label={minimized ? 'Restore window' : 'Minimize window'}
          class="wk-btn"
          title={minimized ? 'Restore' : 'Minimize'}
          onClick={() => {
            const next = !latest.current.minimized;
            setMinimized(next);
            reportLayout({ minimized: next, pos: latest.current.pos, size: latest.current.size });
          }}
        >
          {minimized ? '□' : '–'}
        </button>
        {onClose && (
          <button type="button" aria-label="Close window" class="wk-btn" title="Close" onClick={onClose}>
            ×
          </button>
        )}
      </div>
      {!minimized && <div class="wk-body">{children}</div>}
      {!minimized && RESIZE_HANDLES.map(handle => (
        <div
          key={handle.name}
          aria-hidden="true"
          class={`wk-resize wk-resize-${handle.name}`}
          onPointerDown={startResize(handle.edges)}
        />
      ))}
    </div>
  );
}
