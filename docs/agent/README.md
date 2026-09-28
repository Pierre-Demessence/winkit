# Agent operational notes

Concise, machine-oriented facts. Read on demand.

## Purpose

`@pierre/winkit` — a floating-window library for Preact and React, consumed by
sibling projects as a `file:` dependency. One source tree, two builds.

## Commands

```sh
npm install        # installs and builds (prepare → build)
npm run build      # tsup → dist/index.js, dist/index.d.ts, dist/react/index.js, dist/react/index.d.ts, dist/winkit.css
npm run typecheck  # tsc --noEmit && tsc -p tsconfig.react.json --noEmit (one pass per framework)
npm run lint       # eslint --cache .
npm run lint:fix   # eslint --cache --fix .
npm test           # vitest run (jsdom, two projects: preact + react)
npm run test:watch
npm run test:coverage  # vitest + v8 coverage
npm run check          # lint, typecheck, test, build - the same four as CI
```

There is no dev server in the library itself. `examples/preact` and
`examples/react` are standalone apps for seeing it work: `npm run build` at the
root first, then `npm install && npm run dev` inside one of them. They are run by
hand, nothing in CI starts them, and the root lint deliberately ignores them.

`dist/` is gitignored, so a fresh checkout has no build output until `prepare`
runs. If install scripts are disabled, build before consuming.

## Important paths

- `src/layout.ts` — pure geometry + persistence. **Change clamping or validation
  here, not in the components.**
- `src/Window.tsx` — gestures, persistence wiring, accessible structure.
- `src/WindowLayer.tsx` — stacking order and the coordinate space windows clamp to.
- `src/winkit.css` — all styling; every themeable value is a `--wk-*` custom
  property with an inline fallback.
- `tsup.config.ts` — two configs: the Preact build plus the React one, which uses
  the `preact-to-react` esbuild plugin and `noExternal`. Declarations are scoped to
  `src/index.ts` so the CSS entry emits no empty `.d.ts`.
- `tsconfig.react.json` + `shims/` — the React type pass. The shims supply
  `createContext`, the hooks and `ComponentChildren` from React's types.
- `tests/layout.test.ts` — extend this first when touching clamping or storage.
- `tests/react/` — the React suite; it runs under the `react` vitest project.
- `examples/` — two standalone apps (Preact, React) importing the **built** package
  through `file:../..`; the manual browser check, not automated.
- `.github/workflows/ci.yml` — runs the same four checks on every push and pull
  request, on Node 20.19.0.

## Invariants

- `preact` and `react` are **optional peers**, each external in its own bundle.
  Never add a runtime dependency.
- A source change must compile, test and build for **both** frameworks; the React
  build resolves the `preact` specifiers to React, so anything Preact-only breaks it.
- Anything read from storage is validated before it reaches a style.
- Every gesture releases its listeners on `pointerup`, `pointercancel` and unmount.
- Positions are layer-relative; clamping always uses the layer's measured rect.
- Public surface is `src/index.ts` only.

## Gotchas

- Preact attaches the DOM listener to the element carrying the `on*` prop, so
  `event.currentTarget` is that element. The "Preact delegates to the root" claim
  is false — do not repeat it.
- `useEffect` is deferred; assertions about mount/unmount effects need
  `await act(async () => …)` from `preact/test-utils`.
- `useId` is per root, not per document — ids used by `aria-labelledby` come from
  a module counter.
- React hands handlers a **synthetic** event, Preact the native one. Handlers take
  the structural `PointerLike` / `KeyLike` shapes so both accept them; annotating a
  handler with the DOM event type fails the React type pass.
- esbuild never resolves a path marked external, so the React build's `noExternal`
  is load-bearing: without it the alias plugin is skipped and Preact gets bundled.
- `@types/react` uses `export =`, so `export * from 'react'` in a shim re-exports
  nothing. The shims re-export names explicitly.
- `jsdom` lacks `setPointerCapture`; guard with `typeof` before calling.
- Vitest 4 ignores `test.esbuild`; JSX settings come from `tsconfig.json`.
- Do not write a first-run interactive command here; there is none.

## Verification checklist

Before reporting work complete: `npm run check`, which runs lint, typecheck, test
and build in that order.
