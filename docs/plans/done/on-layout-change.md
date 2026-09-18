# onLayoutChange

Let the host observe a window's moves, resizes and minimize toggles via an
optional callback, without owning the layout state.

## Design

- New prop `onLayoutChange?: (layout: WindowLayout) => void`, where
  `WindowLayout = { minimized: boolean; pos: Point; size: Size }` — the window's
  current committed layout, with required fields (unlike the persisted
  `SavedLayout`, whose fields are all optional).
- Fires imperatively from the user actions that change the layout — each drag
  move, resize step and minimize toggle — so it never fires on the initial mount
  or on an automatic re-clamp (a viewport or monitor change), which a host did
  not cause. Firing reactively from an effect was rejected because a mount-time
  `fit` re-clamp of an off-screen restored window would then fire it in a real
  browser.
- Fires once per pointer move during a drag or resize; a host that wants fewer
  calls can debounce.
- The callback is held in a ref so a gesture in flight always sees the latest
  handler, and a re-render with a new handler never fires it on its own.

## Subtasks

- [x] Add `WindowLayout` type + `onLayoutChange` prop to `types.ts`.
- [x] Export `WindowLayout` from `index.ts`.
- [x] Fire the callback from a layout effect in `Window.tsx`, skipping mount.
- [x] Tests: fires on drag with the new position, fires on minimize, does not
  fire on mount.
- [x] Docs: `README.md` props table + behaviour note, `docs/features.md`, remove
  the roadmap item.
- [x] `npm run check`, then peer review.
