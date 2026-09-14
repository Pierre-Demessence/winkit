import type { Point, Size, StorageLike, WindowProps } from './types';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import { clampPosition, clampSize, DEFAULT_MIN, DEFAULT_POS, DEFAULT_SIZE, readSavedLayout, toPoint, toSize, writeSavedLayout } from './layout';
import { useWindowLayer } from './WindowLayer';

/** Debounce for writing layout to storage, so a drag is one write, not hundreds. */
const SAVE_DEBOUNCE_MS = 300;

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
  const { children, defaultPosition, defaultSize, minSize, onClose, open, persistKey, storage: storageProp, title } = props;
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
  const latest = useRef({ minimized, pos, size });
  latest.current = { minimized, pos, size };

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
  const titleBar = useRef<HTMLDivElement>(null);
  const grip = useRef<HTMLDivElement>(null);
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

  const startDrag = (event: PointerEvent): void => {
    if (event.button !== 0)
      return;
    // The minimize/close buttons sit inside the title bar, so a press on one of
    // them bubbles here and must not begin a drag.
    if (event.target instanceof Element && event.target.closest('button'))
      return;

    bringToFront();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const origin = latest.current.pos;

    beginGesture(event, titleBar.current, (move) => {
      const next = { x: origin.x + (move.clientX - startX), y: origin.y + (move.clientY - startY) };
      const bounds = layer.getBounds();
      setPos(bounds.w > 0 && bounds.h > 0
        ? clampPosition(next, latest.current.size, bounds)
        : { x: Math.max(0, next.x), y: Math.max(0, next.y) });
    });
  };

  const startResize = (event: PointerEvent): void => {
    if (event.button !== 0)
      return;

    bringToFront();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const origin = latest.current.size;

    beginGesture(event, grip.current, (move) => {
      const requested = { h: origin.h + (move.clientY - startY), w: origin.w + (move.clientX - startX) };
      const bounds = layer.getBounds();
      const measurable = bounds.w > 0 && bounds.h > 0;

      const nextSize = measurable
        ? clampSize(requested, minFloor, bounds)
        : { h: Math.max(minFloor.h, requested.h), w: Math.max(minFloor.w, requested.w) };
      setSize(nextSize);

      // Growing towards an edge must not push the window — or its own grip —
      // outside the layer.
      if (measurable) {
        const current = latest.current.pos;
        const nextPos = clampPosition(current, nextSize, bounds);
        if (nextPos.x !== current.x || nextPos.y !== current.y)
          setPos(nextPos);
      }
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
      <div ref={titleBar} class="wk-title" onPointerDown={startDrag}>
        <span id={titleId} class="wk-title-text">{title}</span>
        <button
          type="button"
          aria-label={minimized ? 'Restore window' : 'Minimize window'}
          class="wk-btn"
          title={minimized ? 'Restore' : 'Minimize'}
          onClick={() => setMinimized(m => !m)}
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
      {!minimized && <div ref={grip} aria-hidden="true" class="wk-resize" onPointerDown={startResize} />}
    </div>
  );
}
