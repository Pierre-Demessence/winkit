# Tech stack

## Runtime

- **Preact 10 or React 18+** — optional peers, never bundled. The host supplies
  the one it uses. The library ships ESM only.
- No other runtime dependencies. Ever.

## Language and tooling

| Concern | Choice |
|---|---|
| Language | TypeScript, `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUncheckedIndexedAccess` |
| Bundler | `tsup` (esbuild + `rollup-plugin-dts`), two builds from one source |
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
| `index.js` | `@pierre/winkit` | ESM bundle for Preact; `preact` left external |
| `index.d.ts` | — | Bundled declarations, Preact JSX types |
| `react/index.js` | `@pierre/winkit/react` | The same source built for React; the `preact` specifiers resolve to `react`, which is left external |
| `react/index.d.ts` | — | Bundled declarations, React JSX types |
| `winkit.css` | `@pierre/winkit/styles.css` | A second entry, copied verbatim by the `copy` loader |

The React build is a second `tsup` config. An esbuild `onResolve` plugin maps
`preact`, `preact/hooks` and `preact/jsx-runtime` onto their React equivalents and
keeps React external. esbuild never resolves a path marked external, so that build
also lists `preact` in `noExternal` — without it the plugin is bypassed and Preact
is bundled into the output.

The stylesheet is a separate entry point rather than a side-effect import. That
keeps the JavaScript entry free of side effects, so bundlers can tree-shake it
while still preserving the explicit `@pierre/winkit/styles.css` import.

## Supported targets

- **Node ≥ 20.19** for the toolchain; CI runs on exactly 20.19.0, so the declared
  floor is the tested floor.
- **ES2020** output.
- **Preact 10** or **React 18+** at runtime, whichever the host installs.
- Browsers with the Pointer Events API. Pointer capture is used for drags when
  available and degrades to window-level listeners when it is not.
