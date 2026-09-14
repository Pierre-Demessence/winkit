# Tech stack

## Runtime

- **Preact 10** — a peer dependency, never bundled. The library ships ESM only.
- No other runtime dependencies. Ever.

## Language and tooling

| Concern | Choice |
|---|---|
| Language | TypeScript, `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUncheckedIndexedAccess` |
| Bundler | `tsup` (esbuild + `rollup-plugin-dts`) |
| Tests | `vitest` in a `jsdom` environment, with `@vitest/coverage-v8` on demand |
| Lint | `eslint` with `@antfu/eslint-config` |
| Package manager | `npm` |
| CI | GitHub Actions on Node 20.19.0, running lint, typecheck, test and build |

`erasableSyntaxOnly` rules out enums, namespaces and constructor parameter
properties; `verbatimModuleSyntax` requires type-only imports to be marked.

## Build output

`npm run build` emits to `dist/`:

| Artifact | Consumer import | Notes |
|---|---|---|
| `index.js` | `@pierre/winkit` | Single ESM bundle; `preact` left external |
| `index.d.ts` | — | Bundled declarations |
| `winkit.css` | `@pierre/winkit/styles.css` | A second entry, copied verbatim by the `copy` loader |

The stylesheet is a separate entry point rather than a side-effect import. That
keeps the JavaScript entry free of side effects, so bundlers can tree-shake it
while still preserving the explicit `@pierre/winkit/styles.css` import.

## Supported targets

- **Node ≥ 20.19** for the toolchain; CI runs on exactly 20.19.0, so the declared
  floor is the tested floor.
- **ES2020** output.
- Browsers with the Pointer Events API. Pointer capture is used for drags when
  available and degrades to window-level listeners when it is not.
