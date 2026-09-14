# Plan — packaging follow-ups

## Goal

Resolve the items the packaging audit found and deliberately deferred, so the
package's tooling matches what the documentation claims and nothing is left as a
half-finished intention.

## Context

The audit's Tier 1 work shipped in `2979e09` (metadata, `.gitattributes`, CI,
`0.1.0`, README requirements). Four items were explicitly parked:

- `.gitignore` covers build output but not `npm pack` output, TypeScript build
  info files or editor folders.
- There is no single command that runs the project's definition of done, even
  though `docs/agent/README.md`, `AGENTS.md` and CI all describe the same four
  steps.
- `coverage/` is gitignored, but nothing in the repository can produce it.
- `scripts/copy-css.mjs` exists only to copy the stylesheet into `dist/`, which
  esbuild can do itself with its `copy` loader.

The Preact peer-dependency floor is **not** part of this work: it needs a fact
from Preact's release history that cannot be verified from this machine, and
guessing at a range is worse than the current one.

## Subtasks

- [x] Extend `.gitignore` with `*.tgz`, `*.tsbuildinfo` and `.vscode/`
- [x] Add a `check` script that runs lint, typecheck, test and build in order
- [x] Add coverage tooling and a `test:coverage` script
- [x] Replace `scripts/copy-css.mjs` with esbuild's `copy` loader
- [x] Update every document that describes the stylesheet build or the scripts
- [x] Verify: lint, typecheck, test, coverage, build, and the emitted artifacts

## Decisions

- **Coverage is a local tool, not a CI gate.** `test:coverage` exists so the pure
  seams in `src/layout.ts` can be checked for untested branches on demand. CI keeps
  running the same four checks, so the CI sentence in the docs stays true and no
  workflow time is spent producing a report nobody reads on every push.
- **The stylesheet copy moves into the build config.** `src/winkit.css` becomes a
  second `tsup` entry with `loader: { '.css': 'copy' }`, which deletes a script, an
  `onSuccess` hook and their documentation rather than adding a second mechanism.
  The stylesheet remains a separate artifact, so the JavaScript entry stays free of
  side effects.
- **Declarations are scoped to the JS entry.** A `copy`-loader entry still gets a
  declaration pass, which produced an empty 13-byte `dist/winkit.d.ts`, so `dts`
  now takes `{ entry: 'src/index.ts' }`. The emitted set is back to what the build is
  documented to produce: `index.js`, `index.js.map`, `index.d.ts` and `winkit.css`.
- **`vitest` and `@vitest/coverage-v8` carry identical ranges.** The provider
  requires its own runner version exactly, so both were moved to `^4.1.11`: npm had
  resolved the provider to `4.1.2` and silently dragged `vitest` down from the
  `4.1.11` that was already installed.

## Out of scope

- The Preact peer-dependency floor, as above.
- Sourcemap trimming. `dist/index.js.map` is self-contained (`sourcesContent` is
  present) and therefore correct; it is simply the largest file in the tarball.
- `CHANGELOG.md`, `.editorconfig`, `.nvmrc`, `SECURITY.md` and a `packageManager`
  field: all deliberately absent for a private package.
- The typed `styles.css` export that `arethetypeswrong` flags. A CSS target has no
  types to resolve, so the report is expected; it is only worth revisiting if a
  consumer's TypeScript actually complains.
