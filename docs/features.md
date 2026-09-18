# Features

## What it does

| Feature | Status | Notes |
|---|---|---|
| Floating windows over any content | Built | The layer is click-through where empty, so a canvas or dashboard below stays interactive |
| Drag by the title bar | Built | Clamped to the layer; pointer capture keeps the drag alive outside the page |
| Resize from any edge | Built | Eight handles — four edges and four corners; west/north edges move the origin. Respects `minSize` and the layer bounds |
| Minimize / restore | Built | Per window, remembered across reloads |
| Close | Built | Only when the host passes `onClose` — no dead control |
| Observe layout | Built | `onLayoutChange` reports moves, resizes and minimize toggles; fires per move during a gesture, never on mount |
| Snapping | Built | Opt-in per window via `snap`; edges align to the layer and to other windows while dragging or resizing, within a few pixels |
| Click-to-front stacking | Built | Clicking anywhere in a window raises it; a newly mounted window starts above the ones already there, and a reopened one returns to the front |
| Layout persistence | Built | Opt-in per window via `persistKey`; validated on read |
| Custom persistence target | Built | `storage` accepts any `{ getItem, setItem }` |
| Region-confined layers | Built | Confine the layer with CSS; windows clamp to it automatically |
| Theming | Built | Every colour is a `--wk-*` custom property; layout metrics are fixed by the stylesheet |
| Accessible windows | Built | `role="dialog"`, an accessible name from the visible title, labelled title-bar buttons, Escape to close while focus is inside the window, visible focus rings |
| Stays on screen | Built | Re-clamped on mount and on every resize, so a monitor change cannot strand a window |

## What it deliberately does not do

- **No host-facing registry.** The host decides which windows exist; winkit
  never holds an application-level list. A `WindowLayer` does keep an internal
  list of its live windows' rectangles, used only so windows can snap to one
  another — it is never exposed to the host.
- **No application concepts.** Nothing about panels, dashboards, or what the
  windows contain.
- **No layout engine.** Windows do not reflow or tile. A host that wants a fixed
  grid should use CSS Grid and not this library.
- **No data fetching, no routing, no persistence beyond window geometry.**
