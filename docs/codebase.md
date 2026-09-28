# Codebase

## Layout

```
src/
  index.ts           public surface: components, helpers, types
  types.ts           all shared types (props, geometry, storage)
  layout.ts          pure geometry + persistence (no framework, no DOM)
  WindowLayer.tsx    window host, stacking order, coordinate space
  Window.tsx         one window: drag, resize, minimize, persistence
  winkit.css         styles, fully tokenised with --wk-* custom properties
shims/               type-only React stand-ins for the `preact` specifiers
tsconfig.react.json  React type pass: React JSX, `preact` mapped to the shims
tests/
  layout.test.ts     the pure seam: clamping, validation, storage failures
  window.test.tsx    component semantics and gesture listener lifecycle
  react/             the same components rendered by React
examples/
  preact/            runnable app importing the Preact entry
  react/             runnable app importing the React entry
```

## Module responsibilities

**`layout.ts` is the seam.** Clamping and persistence parsing are pure
functions, deliberately separate from the components, because they are where the
subtle behaviour lives — staying on-screen, rejecting untrusted storage. Keeping
them DOM-free is what makes them testable without a browser and reusable by a
host that wants its own persistence or its own clamping.

**`WindowLayer.tsx` owns the coordinate space.** It measures itself and hands the
size to windows through context, so positions are layer-relative. Confining the
layer confines every window's movement with no extra code.

**`Window.tsx` owns one window's behaviour** and nothing else. It never decides
whether it should exist — the host does, through `open`.

**`types.ts` holds every shared type**, so a component's props can be read in one
place without following imports across modules.

## Conventions

- One component per file; the file is named after the component.
- Pure logic goes in `.ts`, components in `.tsx`.
- CSS classes are prefixed `wk-`; themeable values are always a `--wk-*`
  custom property with an inline fallback.
- Tests live in `tests/` and mirror the module they cover.
- No module-level mutable state, with one documented exception: the id counter in
  `Window.tsx` that keeps `aria-labelledby` targets unique across separate roots.
  All other state is per-component, and all persisted state is validated on read.
- Components stay framework-neutral so one source serves both hosts: JSX uses
  `className` (valid in Preact and React alike), handlers take structural
  `PointerLike` / `KeyLike` shapes rather than either framework's event type, and
  the public `children` type names no framework.

## Testing

`npm test` runs `vitest` under `jsdom` in two projects — `preact` and `react` —
which differ only in whether the `preact` specifiers resolve to Preact or to React,
mirroring the two builds. `npm run test:coverage` adds the v8 coverage report.

- `tests/layout.test.ts` covers clamping, storage validation and storage
  failures — the failure modes that are invisible in a browser until they bite.
- `tests/window.test.tsx` covers the accessible structure (dialog role, label,
  button names, Escape) and the gesture listener lifecycle, including that a
  press on a title-bar button does not begin a drag.
- `tests/react/window.test.tsx` renders the same components through
  `react-dom/client`, covering the layer, the `className` alias, minimize state
  and a pointer drag under React.

`jsdom` has no Pointer Events implementation, so gesture tests dispatch
`MouseEvent` values renamed to `pointerdown`/`pointermove`/`pointerup` with a
`pointerId` attached, then assert on listener registration and on the movement
that was applied. The clamping maths itself is covered directly in the `layout`
tests.

What `jsdom` cannot exercise — real pointer capture, `ResizeObserver`,
`localStorage` round-trips, and how each framework schedules updates — is checked
by hand in `examples/`, which import the built package the way a consumer does.
See `examples/README.md` for the checklist.
