# Examples

Two standalone apps that show the library working — one Preact, one React. They
are run by hand: there is no browser automation here, and nothing in CI starts
them.

## Running one

The examples import the *built* package, so build the library first, then install
and start the example:

```sh
# from the repo root
npm run build

cd examples/preact   # or examples/react
npm install
npm run dev
```

Preact listens on <http://localhost:5181> and React on <http://localhost:5182>, so
both can run at once for comparison.

`npm install` links the repo root as a local dependency, so a change to `src/`
needs `npm run build` at the root again before the example picks it up. If the page
then fails to load, restart the dev server — Vite caches the linked package and can
briefly serve a stale path for it.

Both examples pin their framework to a single copy through `resolve.dedupe`. A
symlinked package resolves `react` or `preact` from its own folder rather than from
the example, and if those versions differ, elements from one copy are rejected by
the other's renderer.

## What to look for

- Dragging by the title bar tracks the pointer, and keeps tracking when the
  pointer leaves the window or the page.
- Resizing works from all four edges and all four corners, and respects
  `minSize`.
- Snapping pulls an edge to the layer edge, or to a sibling window, within a few
  pixels.
- Minimize and restore keep the window's bounds. The close button on "Population"
  hides it and leaves a button to reopen it.
- Reloading restores position, size and minimized state for the two windows with a
  `persistKey`; "No persistence" forgets.
- Clicking the backdrop outside every window still counts a click — the layer is
  click-through where it is empty.
- Resizing the browser window re-clamps windows back on screen.
- Dragging with the pointer leaving the window, and leaving the browser window
  entirely: the gesture keeps tracking, and releasing outside ends it cleanly — no
  window left following the pointer afterwards.

## The two examples differ only in framework details

| | Preact | React |
|---|---|---|
| Entry point | `@pierre/winkit` | `@pierre/winkit/react` |
| Extra layer class | `class` | `className` |
| State | `preact/hooks` | `react` |
| Mount | `render` from `preact` | `createRoot` from `react-dom/client` |

The React example runs inside `StrictMode`, which double-invokes render and mounts
effects twice — the harshest environment a host can impose.
