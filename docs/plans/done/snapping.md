# Snapping

One-shot alignment while dragging or resizing: when a moving edge comes within a
threshold of a snap line — a layer edge or a sibling window's edge — it jumps to
align exactly. Opt-in per window; off by default.

## Architecture

- `WindowLayer` gains an internal, per-instance registry of its live windows'
  rectangles. Every `Window` registers a stable `getRect` getter on mount and
  unregisters on unmount; the getter returns `null` while the window is closed or
  minimized, so those are never snap targets. This registry is **not** exposed to
  the host — the host still decides which windows exist. This reverses the old
  "the library holds no list of windows" non-goal, which `docs/features.md` is
  updated to reflect.
- Registration is unconditional (so any window can be a snap *target*); only the
  snap *behaviour* is gated by the opt-in `snap` prop.
- All snapping maths is pure and unit-tested in `layout.ts`:
  - `snapLines(bounds, rects)` → the candidate `x` / `y` guide lines.
  - `snapPosition(pos, size, lines, threshold)` → adjusted drag position.
  - `snapResizeDelta(origin, edges, delta, lines, threshold)` → an adjusted delta
    fed back through `resizeRect`, so all min/bounds clamping is reused.
- Snapping is skipped when the layer is not measurable (no meaningful lines).

## Subtasks

- [x] Add `Rect` type and `snap?` prop to `types.ts`; export `Rect`.
- [x] Add the registry (`registerWindow` / `getSnapRects`) to the `WindowLayer`
  context.
- [x] Add pure `snapLines`, `snapPosition`, `snapResizeDelta` (+ `nearestLine`)
  to `layout.ts`.
- [x] Register each `Window`; track `open` in the `latest` ref for `getRect`.
- [x] Apply snapping in the drag and resize gesture callbacks when `snap` is on.
- [x] Unit-test the snapping maths.
- [x] Component-test snapping to a sibling and to a layer edge (stub the layer's
  `getBoundingClientRect` so bounds are measurable in jsdom).
- [x] Docs: `README.md` (`snap` prop + behaviour), `docs/features.md` (feature
  row + reword the registry non-goal), remove the roadmap item.
- [x] `npm run check`, then peer review.
