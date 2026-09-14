# Plan — winkit as a standalone package

## Goal

Extract the floating-window system that lived at `LifeSim/src/winkit` into a
reusable package at `Packages/winkit`, so more than one project can consume it.
LifeSim is left untouched; adopting the package there is a separate task.

## Why now

The library was already host-agnostic — Preact was its only dependency — but it
lived inside one consumer, so a second consumer could only copy it and diverge.
This is the "two proven consumers" trigger: extract once a second project
actually needs the code.

## Decisions

- **Built with `tsup`, not shipped as raw TypeScript.** The package lives
  alongside the other `Packages/*` entries, which all build to `dist/` and run
  `prepare: npm run build`, so a `file:` install builds automatically. This also
  makes the package publishable later without restructuring. The caveat: because
  `dist/` is gitignored, `--ignore-scripts` or a policy that blocks install
  scripts leaves a fresh copy with no build output, so `npm run build` must be
  run in the package first.
- **The stylesheet is a separate entry point** (`@pierre/winkit/styles.css`)
  rather than a side-effect import, so the JavaScript entry stays free of side
  effects and bundlers can tree-shake it while preserving the explicit stylesheet
  import.
- **`preact` is a peer dependency** and stays external in the bundle.
- **The layer is the coordinate space.** Clamping uses the layer's measured
  rectangle, so a host confines windows by confining the layer with CSS — no API
  needed for it — and region-awareness falls out of the same code path that fixes
  the off-screen clamp bugs.
- **Clamping and persistence extraction into a pure `layout.ts`.** These are
  where the subtle failures live, so they are separated from Preact and the DOM
  to be unit-testable and reusable.
- **Correctness before features.** The roadmap's maximize/dock/snap/tab work is
  deliberately not attempted here; the bugs and the accessibility gaps are what
  block a second consumer from using the library responsibly.

## Subtasks

- [x] Scaffold the package: `package.json`, `tsconfig.json`, `tsup.config.ts`,
      `vitest.config.ts`, `eslint.config.ts`, `.gitignore`, `LICENSE`
- [x] Extract `src/layout.ts` — pure clamping, validation and persistence
- [x] Fix the off-screen bugs: clamp against window size, re-clamp on mount and resize
- [x] Validate persisted layout instead of trusting it
- [x] Fix gesture handling: pointer capture, `pointercancel`, no leaked listeners
- [x] Stop title-bar buttons from starting a drag
- [x] Bring a reopened window to the front
- [x] Make `WindowLayer` region-aware and give it a stable context identity
- [x] Tokenise `winkit.css` completely; expose the layer z-index as a variable
- [x] Accessibility: `role="dialog"`, accessible name, labelled buttons, Escape, focus ring
- [x] Tests: `tests/layout.test.ts` and `tests/window.test.tsx` (31)
- [x] Docs: `README.md`, `AGENTS.md`, `docs/` set per the house template
- [x] Verify: lint, typecheck, test (31 passing), build
- [x] Peer review and fix every actionable finding

## Out of scope

- Changing anything in LifeSim. A separate task adopts the package there.
- Publishing to npm. The package is `private` for now.
- The feature work in `docs/roadmap.md` (docking, snapping, maximize, tabs).
