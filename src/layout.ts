/**
 * Pure layout maths and persistence for the window system. Kept free of Preact
 * and the DOM so the tricky parts — clamping and untrusted-storage handling —
 * are unit-testable without a browser.
 */

import type { Bounds, Point, ResizeEdges, SavedLayout, Size, StorageLike } from './types';

export const DEFAULT_POS: Point = { x: 24, y: 64 };
export const DEFAULT_SIZE: Size = { w: 320, h: 220 };
export const DEFAULT_MIN: Size = { w: 180, h: 120 };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates an untrusted point — from storage or from component props — and
 * returns `undefined` when it cannot be used. Nothing invalid should ever reach
 * a CSS style, where it would silently produce a broken layout.
 */
export function toPoint(value: unknown): Point | undefined {
  if (typeof value !== 'object' || value === null)
    return undefined;
  const { x, y } = value as { x?: unknown; y?: unknown };
  return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : undefined;
}

/** Validates an untrusted size. Rejects non-positive and non-finite values. */
export function toSize(value: unknown): Size | undefined {
  if (typeof value !== 'object' || value === null)
    return undefined;
  const { h, w } = value as { h?: unknown; w?: unknown };
  return isFiniteNumber(w) && isFiniteNumber(h) && w > 0 && h > 0 ? { h, w } : undefined;
}

/**
 * Parses persisted JSON into a layout, discarding anything malformed. Storage is
 * untrusted: hand-edited or corrupt values must never reach a CSS style, where
 * `Infinity` or a string would produce a broken layout that the user cannot
 * recover from.
 */
export function parseSavedLayout(raw: string | null | undefined): SavedLayout | undefined {
  if (!raw)
    return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  }
  catch {
    return undefined;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return undefined;

  const source = parsed as { minimized?: unknown; pos?: unknown; size?: unknown };
  const layout: SavedLayout = {};

  const pos = toPoint(source.pos);
  if (pos)
    layout.pos = pos;

  const size = toSize(source.size);
  if (size)
    layout.size = size;

  if (typeof source.minimized === 'boolean')
    layout.minimized = source.minimized;

  return layout;
}

/** Reads and validates a persisted layout, never throwing. */
export function readSavedLayout(storage: StorageLike, key: string): SavedLayout | undefined {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  }
  catch {
    // Storage can throw outright (private mode, disabled cookies).
    return undefined;
  }
  return parseSavedLayout(raw);
}

/** Writes a layout, swallowing storage failures (private mode, quota). */
export function writeSavedLayout(storage: StorageLike, key: string, layout: SavedLayout): void {
  try {
    storage.setItem(key, JSON.stringify(layout));
  }
  catch {
    // Persistence is best-effort; a full quota must not break the window.
  }
}

/**
 * Keeps a window inside `bounds`. A window larger than the bounds is pinned to
 * the top-left rather than left hanging off-screen, so it always stays
 * reachable — the failure that strands a restored window after a monitor change.
 */
export function clampPosition(pos: Point, size: Size, bounds: Bounds): Point {
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, bounds.w - size.w)),
    y: Math.min(Math.max(0, pos.y), Math.max(0, bounds.h - size.h)),
  };
}

/**
 * Keeps a window at least `min` big and no bigger than the bounds. When the
 * bounds are smaller than `min`, `min` wins: a usable-but-overhanging window
 * beats one shrunk below the point of being usable.
 */
export function clampSize(size: Size, min: Size, bounds: Bounds): Size {
  return {
    h: Math.min(Math.max(min.h, size.h), Math.max(min.h, bounds.h)),
    w: Math.min(Math.max(min.w, size.w), Math.max(min.w, bounds.w)),
  };
}

/**
 * Applies a resize gesture to a rectangle. The `e`/`s` edges grow from a fixed
 * origin; the `w`/`n` edges anchor the opposite edge, so shrinking the width
 * pushes the origin right instead of stretching off the left. Pass `undefined`
 * bounds while the layer is not yet measurable — then only the minimum and the
 * origin floor apply. As in `clampSize`, the minimum wins over a smaller bound.
 */
export function resizeRect(
  origin: { pos: Point; size: Size },
  edges: ResizeEdges,
  delta: Point,
  min: Size,
  bounds: Bounds | undefined,
): { pos: Point; size: Size } {
  let { x, y } = origin.pos;
  let { h, w } = origin.size;

  if (edges.x === 'e') {
    const room = bounds ? bounds.w - x : Number.POSITIVE_INFINITY;
    w = Math.min(Math.max(min.w, origin.size.w + delta.x), Math.max(min.w, room));
  }
  else if (edges.x === 'w') {
    // Anchor the right edge, capped to the bounds so a layer that shrinks
    // mid-gesture pulls the far edge in rather than stranding it off-screen.
    const right = bounds ? Math.min(origin.pos.x + origin.size.w, bounds.w) : origin.pos.x + origin.size.w;
    x = Math.min(Math.max(0, origin.pos.x + delta.x), right - min.w);
    w = right - x;
  }

  if (edges.y === 's') {
    const room = bounds ? bounds.h - y : Number.POSITIVE_INFINITY;
    h = Math.min(Math.max(min.h, origin.size.h + delta.y), Math.max(min.h, room));
  }
  else if (edges.y === 'n') {
    const bottom = bounds ? Math.min(origin.pos.y + origin.size.h, bounds.h) : origin.pos.y + origin.size.h;
    y = Math.min(Math.max(0, origin.pos.y + delta.y), bottom - min.h);
    h = bottom - y;
  }

  return { pos: { x, y }, size: { h, w } };
}
