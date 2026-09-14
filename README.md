# winkit

A tiny, self-contained floating-window system for Preact. Drag, resize,
minimize, close, click-to-front stacking and layout persistence.

Preact is the only dependency. Nothing here knows about a host application, so
the library drops into any Preact app — or a game rendering behind a click-through
layer.

## Install

Consumed as a local folder dependency by the sibling projects:

```sh
# from a project under S:\Dev\Web\Games\<game>
npm install ../../Packages/winkit
```

The package is `private` and unpublished, so it cannot be installed from a
registry. Installing it as a local folder runs its `prepare` script, which builds
`dist/`. If install scripts are disabled (`--ignore-scripts`, or a policy that
blocks them), run `npm run build` inside the package first — `dist/` is not
committed.

The stylesheet is a separate artifact, so the JavaScript stays side-effect free
and tree-shakeable. Import it once, anywhere in the app:

```ts
import '@pierre/winkit/styles.css';
```

## Usage

```tsx
import { useState } from 'preact/hooks';
import { Window, WindowLayer } from '@pierre/winkit';

function App() {
  const [open, setOpen] = useState(true);
  return (
    <WindowLayer>
      <Window
        title="Population"
        open={open}
        defaultPosition={{ x: 24, y: 64 }}
        defaultSize={{ w: 340, h: 240 }}
        minSize={{ w: 200, h: 140 }}
        persistKey="app.win.population"
        onClose={() => setOpen(false)}
      >
        <MyChart />
      </Window>
    </WindowLayer>
  );
}
```

The host app owns *which* windows are open; the library owns each window's
behaviour.

## API

### `<WindowLayer>`

Hosts windows and manages stacking order. Empty areas pass pointer events
through to whatever is behind it, so it can sit over a `<canvas>`.

The layer is the coordinate space for its windows: positions are relative to it
and windows are clamped to its measured size. It covers the viewport by default.

| Prop | Type | Notes |
|---|---|---|
| `class` | `string` | Extra class on the layer element |

### `<Window>`

| Prop | Type | Notes |
|---|---|---|
| `title` | `string` | Title-bar text, and the window's accessible name |
| `open` | `boolean` | Parent-controlled. When `false` the window renders nothing but **stays mounted**, so its layout state survives |
| `defaultPosition` | `Point` | Used when no persisted layout exists |
| `defaultSize` | `Size` | Used when no persisted layout exists |
| `minSize` | `Size` | Floor while resizing |
| `persistKey` | `string` | Persists position/size/minimized. Reopening a *closed* window restores it; a window minimized at reload stays minimized |
| `storage` | `StorageLike` | Where layout is persisted. Defaults to `localStorage`. Must be referentially stable |
| `onClose` | `() => void` | Adds the close button and the Escape shortcut (active while focus is inside the window) |

Pressing Escape closes the window, but only when `onClose` is provided — no dead
controls, and no unhandled shortcut.

### Exported helpers

The layout maths is a pure module, so a host can reuse it — clamping a window
into a region, or storing layout in its own save blob:

- `clampPosition(pos, size, bounds)` / `clampSize(size, min, bounds)`
- `parseSavedLayout(raw)` / `readSavedLayout(storage, key)` / `writeSavedLayout(storage, key, layout)`
- `DEFAULT_POS`, `DEFAULT_SIZE`, `DEFAULT_MIN`

## Confining windows to a region

By default a window can be dragged anywhere in the viewport. To confine the whole
layer — and therefore every window — to a region, give the parent
`position: relative` and use a compound selector so it wins on specificity:

```css
.guild-hall { position: relative; }
.wk-layer.guild-hall-layer { position: absolute; }
```

```tsx
<div class="guild-hall">
  <WindowLayer class="guild-hall-layer">
    <Window title="Chronicle" open>{/* … */}</Window>
  </WindowLayer>
</div>
```

No JavaScript changes are needed: windows are clamped against the layer's
measured rectangle, so confining the layer confines dragging, resizing and
restore-after-reload alike.

## Theming

Every colour is a CSS custom property with a dark default, and so are the
window radius, font and shadow. Layout metrics — paddings, control sizes,
outline offsets — are fixed by the stylesheet. Override the variables on any
ancestor:

```css
:root {
  --wk-bg: rgba(16, 20, 26, 0.95);
  --wk-border: #2a3138;
  --wk-title: #1b222a;
  --wk-fg: #e6e8ea;
  --wk-btn-bg: #222a32;
  --wk-btn-bg-hover: #2c3742;
  --wk-btn-border: #39424c;
  --wk-btn-fg: #e6e8ea;
  --wk-radius: 8px;
  --wk-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  --wk-font: 12px system-ui, sans-serif;
  --wk-focus: #6ea8fe;
  --wk-resize: #4a545e;
  --wk-layer-z: 20;
}
```

## Behaviour worth knowing

- **Layout is validated on read.** Persisted JSON is untrusted: non-finite
  numbers, wrong types and arrays are discarded rather than applied, so corrupt
  storage can never produce a broken window the user cannot recover from.
- **Windows are always reachable.** A stored position is re-clamped to the layer
  whenever it is measurable and on every resize, so changing monitor or window
  size cannot strand a window off-screen.
- **Gestures always release.** Pointer capture keeps a drag tracking when the
  pointer leaves the page, `pointercancel` is handled, and an unmount mid-drag
  still removes every listener.
- **`localStorage` failures are swallowed.** Private mode and a full quota
  degrade to "no persistence", never to an exception.

## Development

```sh
npm install      # also builds, via the prepare script
npm run lint     # eslint (@antfu)
npm run typecheck
npm test         # vitest + jsdom
npm run build    # tsup → dist/ (js + d.ts) and dist/winkit.css
```

See [docs/INDEX.md](docs/INDEX.md).
