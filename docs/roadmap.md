# Roadmap

Known gaps and planned work, roughly in the order they would pay off. Nothing
here is committed to a release.

## Correctness and robustness

- **Docking** — persistent edge attachment between windows, moving and resizing
  as one unit until undocked. The main gap for a dashboard layout.
- **Snapping** — one-shot alignment to layer edges or other windows while
  dragging.
- **Maximize / restore** — double-click the title bar or a button, remembering
  the previous bounds.
- **Resize from all edges** — currently the bottom-right corner only.
- **Cross-tab layout sync** — via the `storage` event.

## Accessibility

- **Keyboard nudge** — arrow keys to move a focused window.
- **Focus management on open** — move focus into a window when it is opened, and
  return it to the opener on close.
- **Keyboard resize** — the resize grip is mouse-only and marked `aria-hidden`,
  so its affordance is currently unreachable without a pointer.

## Performance

- **Position via `transform` during a drag**, committing state on release.
  Windows currently re-render on every pointer move.

## API

- **`onLayoutChange`** — let the host observe moves and resizes.
- **Imperative ref handle** — programmatic move / resize / maximize.
- **Dev warning** when a `Window` renders outside a `WindowLayer`, where focus
  and clamping silently degrade.
- **Tabbing** — combine several windows into one tabbed window.

## Internal

- Extract a shared pointer-follow helper; `startDrag` and `startResize` are close
  duplicates.

## Recently closed

All eight bugs carried over from the pre-package version are fixed. Clamping and
storage validation are covered directly by unit tests; the drag-start guard, the
gesture listener lifecycle, unmount-mid-gesture release and reopen-to-front
behaviour by component tests. Theming is verified by reading the stylesheet, and
in a browser by the consuming app:

- Clamping now accounts for the window's own size, so a window cannot be dragged
  mostly off-screen.
- A restored window is re-clamped to the layer on mount and on resize.
- Persisted JSON is validated field by field instead of trusted.
- Drags and resizes use pointer capture, handle `pointercancel`, and cannot leak
  listeners if the window unmounts mid-gesture.
- A reopened window returns to the front.
- Title-bar buttons no longer start a drag.
- Theming is complete — no hardcoded colours remain, and the layer's z-index is a
  custom property.
- Windows expose themselves as labelled dialogs, their buttons are named, and
  Escape closes them.
