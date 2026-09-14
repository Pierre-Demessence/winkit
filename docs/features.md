# Features

## What it does

| Feature | Status | Notes |
|---|---|---|
| Floating windows over any content | Built | The layer is click-through where empty, so a canvas or dashboard below stays interactive |
| Drag by the title bar | Built | Clamped to the layer; pointer capture keeps the drag alive outside the page |
| Resize from the corner | Built | Respects `minSize` and the layer bounds |
| Minimize / restore | Built | Per window, remembered across reloads |
| Close | Built | Only when the host passes `onClose` — no dead control |
| Click-to-front stacking | Built | Clicking anywhere in a window raises it; a reopened window comes to the front |
| Layout persistence | Built | Opt-in per window via `persistKey`; validated on read |
| Custom persistence target | Built | `storage` accepts any `{ getItem, setItem }` |
| Region-confined layers | Built | Confine the layer with CSS; windows clamp to it automatically |
| Theming | Built | Every colour is a `--wk-*` custom property; layout metrics are fixed by the stylesheet |
| Accessible windows | Built | `role="dialog"`, an accessible name from the visible title, labelled title-bar buttons, Escape to close while focus is inside the window, visible focus rings |
| Stays on screen | Built | Re-clamped on mount and on every resize, so a monitor change cannot strand a window |

## What it deliberately does not do

- **No global state or registry.** The host decides which windows exist; the
  library holds no list of them.
- **No application concepts.** Nothing about panels, dashboards, or what the
  windows contain.
- **No layout engine.** Windows do not reflow or tile. A host that wants a fixed
  grid should use CSS Grid and not this library.
- **No data fetching, no routing, no persistence beyond window geometry.**
