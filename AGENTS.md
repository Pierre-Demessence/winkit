# AGENTS.md

Agent operating notes for **winkit**. See [docs/INDEX.md](docs/INDEX.md) and
[docs/agent/README.md](docs/agent/README.md).

## What this is

A Preact-only floating-window library. Consumed by sibling game and app projects
as a `file:` dependency. `preact` is a peer dependency and is never bundled.

## Workflow

- Prefer TypeScript; keep JSX in `.tsx`, pure logic in `.ts`.
- Co-locate tests as `*.test.ts(x)` under `tests/`.
- Run lint + typecheck + test + build before marking work complete. CI
  (`.github/workflows/ci.yml`) runs the same four on every push and pull request.
- Keep `docs/` current when behaviour changes; record non-trivial work under
  `docs/plans/`.
- Only commit when explicitly asked. On a feature's final commit, move its plan
  from `docs/plans/` to `docs/plans/done/` in that same commit.

## Invariants (do not break)

- **Preact is the only runtime dependency.** Adding another is a design change,
  not a convenience.
- **The library knows nothing about its host.** No app-specific concepts, no
  global state, no assumptions about what is behind the layer.
- **Storage is untrusted.** Anything read from persistence is validated in
  `src/layout.ts` before it reaches a style.
- **No listener outlives its gesture.** Drags and resizes must release on
  `pointerup`, `pointercancel`, and unmount.
- **The layer is the coordinate space.** Positions are layer-relative and clamped
  to the layer's measured rectangle, so a host can confine windows by confining
  the layer alone.

## Traps found the hard way

- **Preact attaches the DOM listener to the element carrying the `on*` prop**, so
  `event.currentTarget` inside a handler really is that element. Do not repeat the
  common claim that "Preact delegates events to the root container" — it is
  untrue for Preact 10, and it was written here by mistake once.
- **`useEffect` is deferred.** Assertions about mount/unmount or persistence
  effects need `await act(async () => …)` from `preact/test-utils`, or the effect
  has not run yet and the test silently proves nothing.
- **`useId` is per Preact root, not per document.** Two roots produce the same
  id, so ids used by `aria-labelledby` come from a module counter instead.
- **`setPointerCapture` is absent in jsdom.** Guard with a `typeof` check rather
  than assuming it exists, or component tests throw.
- **A reused JSX element object** (assigning a vnode to a `const` and returning it
  from two branches) is safe only while it is built per render. Hoisting it to
  module scope breaks rendering.
- **Vitest 4 uses `oxc`, not `esbuild`.** A `test.esbuild` JSX block is silently
  ignored; let `tsconfig`'s `jsxImportSource` do the work.
- **CSS must be copied, not imported.** `tsup` does not emit a standalone
  stylesheet from an entry import, so `scripts/copy-css.mjs` runs in `onSuccess`.
