# Resize from all edges

Extend resizing beyond the single bottom-right grip to all four edges and four
corners. Dragging the top or left edge moves the window's origin as it resizes;
dragging the bottom or right edge only grows the size, as today.

## Design

- The tricky maths stays pure and unit-tested in `layout.ts`. A new `resizeRect`
  takes the gesture's origin rect, the active edges, the pointer delta, the
  minimum size, and the layer bounds (or `undefined` when the layer is not yet
  measurable), and returns the next `{ pos, size }`.
- West/north edges anchor the opposite edge: the right (or bottom) edge is fixed,
  so shrinking the width moves `x` right and clamps `x >= 0`. East/south edges
  anchor the origin, matching today's behaviour.
- `minSize` and the bounds are honoured the same way `clampSize` does — the
  minimum wins when the bounds are smaller than it.
- `Window` renders eight `aria-hidden` handles (n, s, e, w and the four corners).
  A single `startResize(edges)` factory replaces the old single-grip handler and
  uses `event.currentTarget` as the pointer-capture target.
- Title-bar buttons get `position: relative; z-index` so the top-corner handles
  cannot steal their clicks.

## Subtasks

- [x] Add a `ResizeEdges` type to `types.ts`.
- [x] Add pure `resizeRect` to `layout.ts` with the west/north anchoring maths.
- [x] Replace the single grip in `Window.tsx` with eight handles and a
  `startResize(edges)` factory.
- [x] Rework `winkit.css`: edge strips, corner squares, keep the SE grip
  decoration, lift title-bar buttons above the handles.
- [x] Unit-test `resizeRect` (each edge, each corner, min and bounds clamps,
  unmeasured layer).
- [x] Add a component test that an edge handle starts a resize gesture.
- [x] Update `docs/features.md`, `docs/roadmap.md` (`README.md` already generic).
- [x] `npm run check`, then peer review.
