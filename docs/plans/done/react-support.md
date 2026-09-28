# React support

Make winkit consumable from a React app natively, while keeping the existing
Preact build working. One source tree, two builds.

## Why

Some consuming projects are React, some are Preact. A React host cannot render
Preact components in its own tree, and the two renderers cannot interleave. The
alternative to this plan is bridging (a Preact root mounted inside a React
`ref`), which is workable for a leaf widget but not for a *container*: every
window's body holds host content, so a React app would end up nesting
React → Preact → React, with a separate React root per window and no shared
context or portals across it.

## Goal

- `@pierre/winkit` keeps serving Preact hosts unchanged.
- `@pierre/winkit/react` serves React hosts: native React windows, React
  children, no second runtime copied alongside React.
- One source tree. No fork, no duplicated component logic.

## Non-goals

- Dropping Preact. The Preact entry stays the default export.
- Server-Side Rendering support, `react-dom/server`, hydration guarantees.
- Framework support beyond Preact and React (Vue, Svelte, vanilla).

## Design

### The source is already a compatible subset

Verified against the current source. Value imports are the whole coupling:

| Import | Site | React equivalent |
| --- | --- | --- |
| `createContext` | `src/WindowLayer.tsx@2` | same name, same shape |
| `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`, `useContext` | `src/Window.tsx@2`, `src/WindowLayer.tsx@3` | same names |
| `preact/jsx-runtime` | JSX transform, via `jsxImportSource` in `tsconfig.json` | `react/jsx-runtime` |
| `ComponentChildren` (type only) | `src/types.ts@1` | `ReactNode` |

No portals, no `forwardRef`, no `render()`/`hydrate()`, no `preact/compat`, and
no `useId` — the title id uses a module counter (`src/Window.tsx@29`) precisely
because `useId` is per-root in Preact. So this is a build-configuration change,
not a rewrite.

### Make the source framework-neutral where it is free

- JSX attribute `class` → `className`. `className` is valid in **both** Preact
  and React, so this removes a React dev warning without needing an alias.
  Sites: `src/Window.tsx@317,330,331,335,346,351,356`, `src/WindowLayer.tsx@107`.
- Public prop `WindowLayerProps.class` gains a `className` sibling, so existing
  Preact consumers keep compiling. `className` wins when both are passed, because
  `class` is a React invalid-DOM-property warning and a React host should never
  need it.
- The public `children` type becomes framework-free (`WindowChildren`). A single
  declaration file cannot name both child unions, and naming either one would put
  a bare `preact` or `react` import in the other build's `.d.ts` — which fails for
  a consumer that installed only the other framework. Components cast internally
  where the framework's JSX needs its own node type.

### Two builds

| Build | Output | Runtime imports resolve to | JSX types |
| --- | --- | --- | --- |
| Preact (default) | `dist/index.js` | `preact`, `preact/hooks` | `preact` |
| React | `dist/react/index.js` | `react` | `react` |

- Runtime: a second `tsup` build aliases `preact` → `react`,
  `preact/hooks` → `react`, `preact/jsx-runtime` → `react/jsx-runtime`, and
  marks `react` external. React is a peer, never bundled.
- Types: a second tsconfig sets `jsxImportSource: 'react'` and maps the `preact`
  specifiers to a shim directory so the emitted `.d.ts` carries React element
  and node types, not Preact's. Without this the React entry's component return
  type would leak `preact.JSX.Element` and fail in a React JSX position.
- The stylesheet stays a single shared artifact at `./styles.css`.

### Package surface

```
exports:
  "."          → dist/index.js       (types: dist/index.d.ts)
  "./react"    → dist/react/index.js (types: dist/react/index.d.ts)
  "./styles.css" → dist/winkit.css
```

`react` becomes an optional peer (not `react-dom` — nothing in the source imports
it), declared so package managers do not warn when a React host installs the
package.

## Subtasks

- [x] Neutralize the source: `class` → `className`, add `className` prop
- [x] Make the public `children` type framework-free
- [x] Add the React type shim and `tsconfig.react.json`
- [x] Add the React build to `tsup.config.ts`
- [x] Extend `exports` and add optional React peers in `package.json`
- [x] Typecheck both frameworks in `npm run typecheck`
- [x] Add a `react` vitest project mirroring the build alias
- [x] Add a React smoke test (render, minimize, drag)
- [x] Update `AGENTS.md`, `README.md`, `docs/features.md`, `docs/tech-stack.md`,
      `docs/codebase.md`, `docs/agent/README.md`
- [x] `npm run check` green, then `npm audit` for the added devDependencies
- [x] Verify the React build in a real browser — exercised through `examples/react`
      (drag, snapping, resize, `minSize`, minimize, persistence across reload,
      click-through); see `docs/plans/examples.md` for the full record
- [x] Verify the React peer range against React 18 — React 18.3.1 with
      `@types/react` 18.2.79 installed in `examples/react`: it type-checks, builds,
      and passes the whole browser checklist. The floor is declared `>=18.2` because
      the declarations use `React.JSX`, which the 18.0/18.1 types lack.

## Verification

- `npm run check` (lint, typecheck, test, build) mirrors CI and must stay green
  for both builds.
- Emitted `dist/react/index.js` must import `react`, not `preact`.
- A React consumer must render `<WindowLayer><Window>` and see the same DOM and
  class names as the Preact build.

## Risks

- **Update scheduling differs.** React and Preact batch state updates on
  different boundaries, and windows re-render on every pointer move during a
  drag (`src/Window.tsx`, and the `transform` item in `docs/roadmap.md`). A
  timing difference could surface as jitter or a dropped frame. Tests in jsdom
  cannot prove this — it needs a browser pass on the React build.
- **React 19 ref and effect semantics** differ enough from Preact that the React
  type-check may need small adjustments. Failure mode is a build error, which is
  loud and cheap.
- **Two builds to keep working.** Every future source change must compile and
  pass both. CI runs `npm run check`, which covers both.
- **`Window` mutates a layer-owned ref and the id counter during render**
  (`src/Window.tsx`). Correct under Preact and harmless under React (a replayed
  render only skips numbers), but it is a render-phase side effect that React's
  StrictMode double-invokes. Moving it to an effect would change when the stacking
  order is assigned, so it stays until something observes the difference.
- **A linked install can mix framework copies.** The package resolves `react` or
  `preact` from its own directory, so a host pinning a different version ends up with
  two copies and one copy's elements are rejected by the other's renderer
  (`Objects are not valid as a React child`). Found by running the React example on
  React 18 while the repo root held React 19. Both examples now set `resolve.dedupe`;
  any host consuming this by folder has to do the same.
