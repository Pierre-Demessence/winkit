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

- **Imperative ref handle** — programmatic move / resize / maximize.
- **Dev warning** when a `Window` renders outside a `WindowLayer`, where focus
  and clamping silently degrade.
- **Tabbing** — combine several windows into one tabbed window.
