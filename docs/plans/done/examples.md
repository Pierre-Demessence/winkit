# Runnable examples

Two small apps under `examples/` — one Preact, one React — that show the library
working and double as the manual end-to-end check this repo otherwise lacks.

## Why

The library has no dev server, so today the only way to see it work is inside a
consuming project. Examples fix that twice over:

- **Manual end-to-end verification.** Real pointer events, pointer capture,
  `ResizeObserver` and `localStorage` round-trips — the things `jsdom` cannot
  exercise, and where the React-versus-Preact update-timing risk shows up.
- **A demo.** Anyone reading the repo can see what it does without adopting it.

They are run by hand, on purpose. No browser automation, no CI job.

## Non-goals

- No Playwright, no browser-mode test runner, no screenshots.
- No npm workspaces: the root package's install model stays exactly as it is.
- No docs site, no Storybook, no extra runtime library.

## Shape

```
examples/
  README.md           how to run each one, and what to look for
  preact/
    package.json      `@pierre/winkit` as `file:../..`, plus preact + vite
    index.html
    src/main.tsx      mounts <App/>
    src/App.tsx       a layer with a few windows
    src/styles.css    page dressing the examples need (not library styles)
    tsconfig.json
    vite.config.ts
  react/
    (the same, with react + react-dom and `@pierre/winkit/react`)
```

## Decisions

- **Import the built package, never `src/`.** The examples import
  `@pierre/winkit` and `@pierre/winkit/react` as a consumer does, so running them
  exercises the `exports` map, both entries and the emitted declarations. Importing
  source would hide exactly the wiring being verified.
- **`file:../..`, not workspaces.** npm symlinks a local directory dependency, so
  the example sees the root package as installed — through `exports` — and an
  example can be copied out of the repo unchanged.
- **Build the library first.** `npm run build` at the repo root, then install and
  start an example. Documented explicitly, because `--ignore-scripts` or a
  no-install-scripts policy leaves the example resolving a missing `dist/`.
- **Examples stay out of the root `check`.** Each needs its own `node_modules`,
  and the two JSX runtimes conflict with each other, so they carry their own
  `tsconfig.json` and are type-checked by their own scripts.
- One dependency each (Vite) plus the framework. Nothing else.

## What they show

Both examples: a layer over a decorative background, three windows, drag, resize
from every edge, minimize, one window with `onClose`, `snap`, a `persistKey` that
survives a reload, and an empty area where pointer events pass through.

- **Preact example** — the `class` prop, and `preact/hooks` state driving `open`.
- **React example** — the `className` prop, React state driving `open`, and React
  components as window children. That last case is the reason React support exists.

### The manual checklist

Things that only a real browser can answer, run in both examples:

- A drag tracks the pointer with no lag or overshoot, and continues when the
  pointer leaves the window or the page.
- Resize is stable from all eight edges and corners, and respects `minSize`.
- Minimize and restore keep the window's bounds.
- Reloading restores position, size and minimized state.
- Resizing the browser window re-clamps windows on screen.
- The empty area of the layer passes clicks through to the background.
- Under React specifically: none of the above is affected by React batching
  updates differently from Preact.

## Subtasks

- [x] `examples/preact/` — app, config, styles
- [x] `examples/react/` — app, config, styles
- [x] `examples/README.md` — how to run, and the checklist above
- [x] `docs/codebase.md` and `docs/agent/README.md` — record the folder and that it
      is manual, and keep it out of root lint
- [x] `README.md` — point at the examples
- [x] Run both by hand and record what was verified
- [x] Tick the open browser-verification item in `docs/plans/react-support.md`

## Verified

Both examples installed, type-checked (`tsc --noEmit`) and built with Vite. Then
run on their dev servers and driven with real mouse input in Chromium:

- **React entry** — a drag landed exactly where the pointer went (+120 px, no lag or
  overshoot); the window's top stopped at a sibling's edge, so snapping engaged;
  resize from a corner grew it by exactly the pointer delta (+60/+40) and shrank to
  the `minSize` floor of 220×150 and no further; minimize removed the body; a click
  on the backdrop outside every window still registered, so the layer is
  click-through; a reload restored the dragged position and the minimized state,
  while the window without a `persistKey` returned to its default — so layout
  survived a real `localStorage` round-trip. A window whose default position put it
  past the measured layer edge came back clamped inside it.
- **Preact entry** — the same page rendered and the same drag moved the window by
  exactly the pointer delta, with the layer's `class` prop producing
  `wk-layer demo-layer`.
- The examples resolve the package through its `exports` map: the stylesheet import
  resolves, and React bundles without Preact installed.

Not covered: dragging with the pointer leaving the window or the page (pointer
capture), and how a drag *feels* — no test can judge smoothness.

The React example was then re-run on React 18.3.1 with `@types/react` 18.2.79 — the
same checklist, the same results — which is what confirmed the peer floor.

That first run failed, and usefully: the symlinked package resolved `react` from the
repo root (React 19) while the example supplied React 18, so React rejected its own
elements ("Objects are not valid as a React child"). Both examples now set
`resolve.dedupe`; the cause is recorded in `docs/plans/react-support.md`.

## Risks

- **They rot.** The examples sit outside CI and nothing fails when they break.
  They are kept to a handful of files, and a stale example still beats no example.
- **Extra installs.** Each example pulls its own `node_modules` (Vite and one
  framework). Only paid by whoever runs them.
- **`file:` is a symlink**, so a change to `src/` needs `npm run build` again
  before the example sees it, and Vite may need a restart to drop its cached
  dependency.
