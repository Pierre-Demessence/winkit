# Agent operational notes

Concise, machine-oriented facts. Read on demand.

## Purpose

`@pierre/winkit` — a Preact-only floating-window library, consumed by sibling
projects as a `file:` dependency.

## Commands

```sh
npm install        # installs and builds (prepare → build)
npm run build      # tsup → dist/index.js, dist/index.d.ts, dist/winkit.css
npm run typecheck  # tsc --noEmit
npm run lint       # eslint --cache .
npm run lint:fix   # eslint --cache --fix .
npm test           # vitest run (jsdom)
npm run test:watch
```

There is no dev server. Exercise the library in a consuming app.

`dist/` is gitignored, so a fresh checkout has no build output until `prepare`
runs. If install scripts are disabled, build before consuming.

## Important paths

- `src/layout.ts` — pure geometry + persistence. **Change clamping or validation
  here, not in the components.**
- `src/Window.tsx` — gestures, persistence wiring, accessible structure.
- `src/WindowLayer.tsx` — stacking order and the coordinate space windows clamp to.
- `src/winkit.css` — all styling; every themeable value is a `--wk-*` custom
  property with an inline fallback.
- `scripts/copy-css.mjs` — runs from `tsup`'s `onSuccess`; the stylesheet must be
  copied, it is not derived from the JS entry.
- `tests/layout.test.ts` — extend this first when touching clamping or storage.
- `.github/workflows/ci.yml` — runs the same four checks on every push and pull
  request, on Node 20.19.0.

## Invariants

- `preact` is a **peer** dependency and stays external in the bundle. Never add a
  runtime dependency.
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
- `useId` is per Preact root, not per document — ids used by `aria-labelledby`
  come from a module counter.
- `jsdom` lacks `setPointerCapture`; guard with `typeof` before calling.
- Vitest 4 ignores `test.esbuild`; JSX settings come from `tsconfig.json`.
- Do not write a first-run interactive command here; there is none.

## Verification checklist

Before reporting work complete: `npm run lint`, `npm run typecheck`,
`npm test`, `npm run build` — all four, in that order.
