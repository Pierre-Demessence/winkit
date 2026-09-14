# Plan — packaging hardening

## Goal

Close the gaps found by auditing winkit as a *package* rather than as a library:
the parts that decide whether a consumer can install it, find its source, and
trust that a pushed commit actually builds. Library behaviour and API design are
explicitly out of scope.

## Context

The install path already holds up, so nothing here is a repair:

- `publint` reports "All good".
- `npm pack --dry-run` ships 7 files (16.2 kB compressed) with `LICENSE` and
  `README.md` included automatically.
- `preact`, `preact/hooks` and `preact/jsx-runtime` all stay external in
  `dist/index.js`, with no Preact internals bundled.

What was missing is repository scaffolding: nothing verified that a pushed commit
builds, which matters more than usual here because `dist/` is gitignored and every
consumer builds this package from a commit rather than from a published artifact.

## Subtasks

- [x] Add `repository`, `bugs` and `homepage` to `package.json`
- [x] Add `.gitattributes` to normalise line endings
- [x] Add `.github/workflows/ci.yml` running lint, typecheck, test and build
- [x] Set the version to `0.1.0` and tag the release
- [x] Document the ESM-only and Preact requirements in `README.md`
- [x] Verify: lint, typecheck, test (31 passing), build, and a clean `git status`

## Decisions

- **CI pins Node 20.19.0, the declared floor.** `engines.node` claimed `>=20`, but
  `eslint@10` and `jsdom@29` both require `^20.19.0 || ^22.13.0 || >=24`, so the claim
  was corrected to `>=20.19.0` and `package-lock.json` resynced with
  `npm install --package-lock-only`. The workflow asks for that exact version rather
  than `20`, so the declared floor is the floor CI actually tests.
- **One job, no matrix.** A single lint/typecheck/test/build job on `ubuntu-latest`
  answers the only question that matters for a private library consumed by sibling
  projects: does this commit install and build?
- **No dependency scanning or CodeQL in this change.** `dependency-review-action`
  and CodeQL are worth adding once the repository has other contributors; adding
  them now would gate the author's own pushes on tooling that has nothing to catch
  in a package with one peer dependency and no runtime dependencies.

## Accepted risk

`npm audit` reports one low-severity advisory: `esbuild` 0.27.3–0.28.0 allows arbitrary
file reads through its **development server** on Windows (GHSA-g7r4-m6w7-qqqr). The
installed `0.27.7` arrives through `tsup`, which declares `esbuild: ^0.27.0`, so the
patched release sits outside that range and the only fix available is to move `tsup` off
the dependency set it supports.

It is accepted because winkit never runs an esbuild development server — there is no dev
or serve script, and `tsup` uses the build API — and because `esbuild` is a build-time
dependency that never reaches a consumer: the published tarball is 7 files with no
`node_modules`.

## Out of scope

- Preact peer-dependency floor. `package.json` declares `^10.0.0` while the emitted
  code imports the `preact/jsx-runtime` subpath. Which release first shipped that
  export could not be verified from this machine, so the range is left alone rather
  than guessed at.
- `.gitignore` additions (`*.tgz`, `*.tsbuildinfo`, `.vscode/`), an aggregate
  `check` script, coverage tooling and the removal of `scripts/copy-css.mjs` in
  favour of esbuild's `copy` loader — all audited, all deliberately deferred.
- The library's own behaviour, API and documentation set.
