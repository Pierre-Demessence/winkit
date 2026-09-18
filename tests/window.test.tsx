import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Window } from '../src/Window';
import { WindowLayer } from '../src/WindowLayer';

let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  render(null, host);
  host.remove();
});

function dialog(): HTMLElement | null {
  return host.querySelector<HTMLElement>('[role="dialog"]');
}

/** The accessible name, resolved from the id the dialog is labelled by. */
function titleOf(element: HTMLElement | null): string | undefined {
  const labelId = element?.getAttribute('aria-labelledby');
  return labelId ? (document.getElementById(labelId)?.textContent ?? undefined) : undefined;
}

function findWindow(title: string): HTMLElement | null {
  return [...host.querySelectorAll<HTMLElement>('.wk-window')]
    .find(element => titleOf(element) === title) ?? null;
}

/**
 * `jsdom` has no PointerEvent, but the handlers only read MouseEvent fields plus
 * `pointerId`, which is attached here so per-pointer behaviour is testable.
 */
function pointerEvent(type: string, pointerId: number, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, button: 0, ...init });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

function pointerDown(target: Element, pointerId = 1): void {
  target.dispatchEvent(pointerEvent('pointerdown', pointerId));
}

describe('window semantics', () => {
  it('exposes itself as a dialog named by its title', () => {
    render(
      <WindowLayer>
        <Window open title="Population">
          <p>body</p>
        </Window>
      </WindowLayer>,
      host,
    );

    const element = dialog();
    expect(titleOf(element)).toBe('Population');
    expect(host.textContent).toContain('body');
  });

  it('renders nothing while closed', () => {
    render(
      <WindowLayer>
        <Window open={false} title="Hidden">
          <p>body</p>
        </Window>
      </WindowLayer>,
      host,
    );

    expect(dialog()).toBeNull();
    expect(host.textContent).not.toContain('body');
  });

  it('gives every title-bar button an accessible name', () => {
    render(
      <WindowLayer>
        <Window open title="T" onClose={() => {}} />
      </WindowLayer>,
      host,
    );

    const labels = [...host.querySelectorAll('button')].map(button => button.getAttribute('aria-label'));
    expect(labels).toEqual(['Minimize window', 'Close window']);
  });

  it('omits the close button when no handler is given, leaving no dead control', () => {
    render(
      <WindowLayer>
        <Window open title="T" />
      </WindowLayer>,
      host,
    );

    expect(host.querySelectorAll('button')).toHaveLength(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <WindowLayer>
        <Window open title="T" onClose={onClose} />
      </WindowLayer>,
      host,
    );

    dialog()?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders outside a layer without crashing', () => {
    render(<Window open title="Orphan" />, host);
    expect(titleOf(dialog())).toBe('Orphan');
  });

  it('raises a reopened window above the others', async () => {
    const view = (open: boolean) => (
      <WindowLayer>
        <Window open title="Sibling" />
        <Window open={open} title="Reopened" />
      </WindowLayer>
    );

    // `act` flushes Preact's deferred effects; without it the reopen transition
    // has not run when the assertions are made.
    await act(async () => {
      render(view(false), host);
    });
    await act(async () => {
      render(view(true), host);
    });

    const reopened = Number(findWindow('Reopened')?.style.zIndex ?? 0);
    const sibling = Number(findWindow('Sibling')?.style.zIndex ?? 0);
    expect(reopened).toBeGreaterThan(sibling);
  });

  it('stacks a newly mounted window above the ones already there', async () => {
    // A window that mounts already open never fires the open transition, so its
    // stacking order has to be right from the initial render.
    const view = (showSecond: boolean) => (
      <WindowLayer>
        <Window open title="First" />
        {showSecond && <Window open title="Second" />}
      </WindowLayer>
    );

    await act(async () => {
      render(view(false), host);
    });
    await act(async () => {
      render(view(true), host);
    });

    const first = Number(findWindow('First')?.style.zIndex ?? 0);
    const second = Number(findWindow('Second')?.style.zIndex ?? 0);
    expect(second).toBeGreaterThan(first);
  });
  it('rejects unusable props rather than emitting a broken style', () => {
    render(
      <WindowLayer>
        <Window
          open
          defaultPosition={{ x: Number.NaN, y: 10 }}
          defaultSize={{ h: 100, w: Number.NaN }}
          title="Bad props"
        />
      </WindowLayer>,
      host,
    );

    const element = dialog();
    expect(element?.style.width).not.toContain('NaN');
    expect(element?.style.width).toBe('320px');
    expect(element?.style.height).toBe('220px');
    expect(element?.style.left).toBe('24px');
    expect(element?.style.top).toBe('64px');
  });
});

describe('drag gestures', () => {
  it('does not begin a drag when a title-bar button is pressed', () => {
    render(
      <WindowLayer>
        <Window open title="T" onClose={() => {}} />
      </WindowLayer>,
      host,
    );

    const spy = vi.spyOn(window, 'addEventListener');
    const button = host.querySelector('button');
    if (!button)
      throw new Error('expected a title-bar button');
    pointerDown(button);

    const moves = spy.mock.calls.filter(([type]) => type === 'pointermove');
    spy.mockRestore();
    expect(moves).toHaveLength(0);
  });

  it('tracks the pointer once a drag starts on the title bar', () => {
    render(
      <WindowLayer>
        <Window open title="T" />
      </WindowLayer>,
      host,
    );

    const spy = vi.spyOn(window, 'addEventListener');
    const title = host.querySelector<HTMLElement>('.wk-title');
    if (!title)
      throw new Error('expected a title bar');
    pointerDown(title);

    const moves = spy.mock.calls.filter(([type]) => type === 'pointermove');
    spy.mockRestore();
    expect(moves).toHaveLength(1);
  });

  it('releases every listener when the gesture ends', () => {
    render(
      <WindowLayer>
        <Window open title="T" />
      </WindowLayer>,
      host,
    );

    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const title = host.querySelector<HTMLElement>('.wk-title');
    if (!title)
      throw new Error('expected a title bar');

    pointerDown(title);
    window.dispatchEvent(pointerEvent('pointerup', 1));

    const added = addSpy.mock.calls.map(([type]) => type);
    const removed = removeSpy.mock.calls.map(([type]) => type);
    addSpy.mockRestore();
    removeSpy.mockRestore();

    expect(added).toEqual(['pointermove', 'pointerup', 'pointercancel']);
    expect(removed).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']));
  });

  it('ignores a different pointer for both moves and release', async () => {
    await act(async () => {
      render(
        <WindowLayer>
          <Window open title="T" />
        </WindowLayer>,
        host,
      );
    });

    const title = host.querySelector<HTMLElement>('.wk-title');
    if (!title)
      throw new Error('expected a title bar');

    await act(async () => {
      pointerDown(title, 1);
    });
    const startLeft = dialog()?.style.left;

    // A move from an unrelated pointer must be ignored.
    await act(async () => {
      window.dispatchEvent(pointerEvent('pointermove', 2, { clientX: 50 }));
    });
    expect(dialog()?.style.left).toBe(startLeft);

    // The gesture's own pointer moves the window.
    await act(async () => {
      window.dispatchEvent(pointerEvent('pointermove', 1, { clientX: 50 }));
    });
    expect(dialog()?.style.left).not.toBe(startLeft);

    // And another pointer lifting must not end it.
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    await act(async () => {
      window.dispatchEvent(pointerEvent('pointerup', 2));
    });
    const removed = removeSpy.mock.calls.map(([type]) => type);
    removeSpy.mockRestore();
    expect(removed).toHaveLength(0);
  });

  it('releases every listener when unmounted mid-gesture', async () => {
    await act(async () => {
      render(
        <WindowLayer>
          <Window open title="T" />
        </WindowLayer>,
        host,
      );
    });

    const title = host.querySelector<HTMLElement>('.wk-title');
    if (!title)
      throw new Error('expected a title bar');
    pointerDown(title);

    const removeSpy = vi.spyOn(window, 'removeEventListener');
    await act(async () => {
      render(null, host);
    });
    const removed = removeSpy.mock.calls.map(([type]) => type);
    removeSpy.mockRestore();

    expect(removed).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']));
  });
});

describe('resize gestures', () => {
  it('exposes a handle on every edge and corner', () => {
    render(
      <WindowLayer>
        <Window open title="T" />
      </WindowLayer>,
      host,
    );

    const handles = [...host.querySelectorAll('.wk-resize')].map(el => el.className.split(' ')[1]);
    expect(handles).toEqual([
      'wk-resize-n',
      'wk-resize-s',
      'wk-resize-e',
      'wk-resize-w',
      'wk-resize-ne',
      'wk-resize-nw',
      'wk-resize-se',
      'wk-resize-sw',
    ]);
  });

  it('starts a resize gesture from an edge handle', () => {
    render(
      <WindowLayer>
        <Window open title="T" />
      </WindowLayer>,
      host,
    );

    const spy = vi.spyOn(window, 'addEventListener');
    const handle = host.querySelector<HTMLElement>('.wk-resize-e');
    if (!handle)
      throw new Error('expected an east resize handle');
    pointerDown(handle);

    const moves = spy.mock.calls.filter(([type]) => type === 'pointermove');
    spy.mockRestore();
    expect(moves).toHaveLength(1);
  });

  it('grows from the south-east corner without moving the origin', async () => {
    await act(async () => {
      render(
        <WindowLayer>
          <Window open defaultPosition={{ x: 24, y: 64 }} defaultSize={{ h: 220, w: 320 }} title="T" />
        </WindowLayer>,
        host,
      );
    });

    const handle = host.querySelector<HTMLElement>('.wk-resize-se');
    if (!handle)
      throw new Error('expected a south-east handle');

    await act(async () => {
      pointerDown(handle, 1);
      window.dispatchEvent(pointerEvent('pointermove', 1, { clientX: 50, clientY: 30 }));
    });

    const element = dialog();
    expect(element?.style.width).toBe('370px');
    expect(element?.style.height).toBe('250px');
    expect(element?.style.left).toBe('24px');
    expect(element?.style.top).toBe('64px');
  });

  it('moves the origin when growing from the north-west corner', async () => {
    await act(async () => {
      render(
        <WindowLayer>
          <Window open defaultPosition={{ x: 24, y: 64 }} defaultSize={{ h: 220, w: 320 }} title="T" />
        </WindowLayer>,
        host,
      );
    });

    const handle = host.querySelector<HTMLElement>('.wk-resize-nw');
    if (!handle)
      throw new Error('expected a north-west handle');

    await act(async () => {
      pointerDown(handle, 1);
      window.dispatchEvent(pointerEvent('pointermove', 1, { clientX: -30, clientY: -40 }));
    });

    const element = dialog();
    expect(element?.style.left).toBe('0px');
    expect(element?.style.top).toBe('24px');
    expect(element?.style.width).toBe('344px');
    expect(element?.style.height).toBe('260px');
  });
});

describe('onLayoutChange', () => {
  it('does not fire on the initial mount', async () => {
    const onLayoutChange = vi.fn();
    await act(async () => {
      render(
        <WindowLayer>
          <Window open title="T" onLayoutChange={onLayoutChange} />
        </WindowLayer>,
        host,
      );
    });

    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it('reports the new position while dragging', async () => {
    const onLayoutChange = vi.fn();
    await act(async () => {
      render(
        <WindowLayer>
          <Window open defaultPosition={{ x: 24, y: 64 }} title="T" onLayoutChange={onLayoutChange} />
        </WindowLayer>,
        host,
      );
    });

    const title = host.querySelector<HTMLElement>('.wk-title');
    if (!title)
      throw new Error('expected a title bar');

    await act(async () => {
      pointerDown(title, 1);
      window.dispatchEvent(pointerEvent('pointermove', 1, { clientX: 50, clientY: 10 }));
    });

    expect(onLayoutChange).toHaveBeenLastCalledWith({
      minimized: false,
      pos: { x: 74, y: 74 },
      size: { h: 220, w: 320 },
    });
  });

  it('reports a minimize toggle', async () => {
    const onLayoutChange = vi.fn();
    await act(async () => {
      render(
        <WindowLayer>
          <Window open title="T" onLayoutChange={onLayoutChange} />
        </WindowLayer>,
        host,
      );
    });

    const button = host.querySelector<HTMLButtonElement>('button');
    if (!button)
      throw new Error('expected the minimize button');

    await act(async () => {
      button.click();
    });

    expect(onLayoutChange).toHaveBeenLastCalledWith({
      minimized: true,
      pos: { x: 24, y: 64 },
      size: { h: 220, w: 320 },
    });
  });

  it('reports the new size while resizing', async () => {
    const onLayoutChange = vi.fn();
    await act(async () => {
      render(
        <WindowLayer>
          <Window open defaultSize={{ h: 220, w: 320 }} title="T" onLayoutChange={onLayoutChange} />
        </WindowLayer>,
        host,
      );
    });

    const handle = host.querySelector<HTMLElement>('.wk-resize-se');
    if (!handle)
      throw new Error('expected a south-east handle');

    await act(async () => {
      pointerDown(handle, 1);
      window.dispatchEvent(pointerEvent('pointermove', 1, { clientX: 40, clientY: 30 }));
    });

    expect(onLayoutChange).toHaveBeenLastCalledWith({
      minimized: false,
      pos: { x: 24, y: 64 },
      size: { h: 250, w: 360 },
    });
  });

  it('does not fire merely because the window re-renders with a new handler', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = (handler: () => void) => (
      <WindowLayer>
        <Window open title="T" onLayoutChange={handler} />
      </WindowLayer>
    );

    await act(async () => {
      render(view(first), host);
    });
    await act(async () => {
      render(view(second), host);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});

describe('snapping', () => {
  // jsdom leaves getBoundingClientRect at zero, so the layer reads as unmeasured
  // and snapping is skipped. Give the layer a real rectangle to exercise it.
  function stubLayerBounds(width = 800, height = 600): void {
    const layerEl = host.querySelector<HTMLElement>('.wk-layer');
    if (!layerEl)
      throw new Error('expected a layer');
    Object.defineProperty(layerEl, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ bottom: height, height, left: 0, right: width, toJSON: () => {}, top: 0, width, x: 0, y: 0 }),
    });
  }

  function drag(window: HTMLElement, clientX: number, clientY = 0): void {
    const title = window.querySelector<HTMLElement>('.wk-title');
    if (!title)
      throw new Error('expected a title bar');
    pointerDown(title, 1);
    globalThis.window.dispatchEvent(pointerEvent('pointermove', 1, { clientX, clientY }));
  }

  it('snaps a dragged window edge to a sibling', async () => {
    await act(async () => {
      render(
        <WindowLayer>
          <Window open defaultPosition={{ x: 100, y: 50 }} defaultSize={{ h: 150, w: 200 }} title="Anchor" />
          <Window open snap defaultPosition={{ x: 400, y: 50 }} defaultSize={{ h: 150, w: 200 }} title="Mover" />
        </WindowLayer>,
        host,
      );
    });
    stubLayerBounds();

    const mover = findWindow('Mover');
    if (!mover)
      throw new Error('expected the mover');

    // Left edge 400 - 95 = 305 lands within 8px of the sibling's right edge (300).
    await act(async () => {
      drag(mover, -95);
    });

    expect(mover.style.left).toBe('300px');
  });

  it('snaps a dragged window to the layer edge', async () => {
    await act(async () => {
      render(
        <WindowLayer>
          <Window open snap defaultPosition={{ x: 400, y: 50 }} defaultSize={{ h: 150, w: 200 }} title="Mover" />
        </WindowLayer>,
        host,
      );
    });
    stubLayerBounds();

    const mover = findWindow('Mover');
    if (!mover)
      throw new Error('expected the mover');

    // Left edge 400 - 397 = 3 lands within 8px of the layer's left edge (0).
    await act(async () => {
      drag(mover, -397);
    });

    expect(mover.style.left).toBe('0px');
  });

  it('does not snap when the prop is off', async () => {
    await act(async () => {
      render(
        <WindowLayer>
          <Window open defaultPosition={{ x: 100, y: 50 }} defaultSize={{ h: 150, w: 200 }} title="Anchor" />
          <Window open defaultPosition={{ x: 400, y: 50 }} defaultSize={{ h: 150, w: 200 }} title="Mover" />
        </WindowLayer>,
        host,
      );
    });
    stubLayerBounds();

    const mover = findWindow('Mover');
    if (!mover)
      throw new Error('expected the mover');

    await act(async () => {
      drag(mover, -95);
    });

    expect(mover.style.left).toBe('305px');
  });

  it('snaps a resized edge to a sibling edge', async () => {
    await act(async () => {
      render(
        <WindowLayer>
          <Window open defaultPosition={{ x: 400, y: 50 }} defaultSize={{ h: 150, w: 200 }} title="Anchor" />
          <Window open snap defaultPosition={{ x: 50, y: 50 }} defaultSize={{ h: 150, w: 200 }} title="Mover" />
        </WindowLayer>,
        host,
      );
    });
    stubLayerBounds();

    const mover = findWindow('Mover');
    if (!mover)
      throw new Error('expected the mover');
    const handle = mover.querySelector<HTMLElement>('.wk-resize-e');
    if (!handle)
      throw new Error('expected an east handle');

    // Right edge 250 + 145 = 395 lands within 8px of the sibling's left edge (400).
    await act(async () => {
      pointerDown(handle, 1);
      globalThis.window.dispatchEvent(pointerEvent('pointermove', 1, { clientX: 145, clientY: 0 }));
    });

    expect(mover.style.width).toBe('350px');
  });

  it('does not snap to a minimized sibling', async () => {
    await act(async () => {
      render(
        <WindowLayer>
          <Window open defaultPosition={{ x: 100, y: 50 }} defaultSize={{ h: 150, w: 200 }} title="Anchor" />
          <Window open snap defaultPosition={{ x: 400, y: 50 }} defaultSize={{ h: 150, w: 200 }} title="Mover" />
        </WindowLayer>,
        host,
      );
    });
    stubLayerBounds();

    const anchor = findWindow('Anchor');
    const minimize = anchor?.querySelector<HTMLButtonElement>('button');
    if (!minimize)
      throw new Error('expected the minimize button');
    await act(async () => {
      minimize.click();
    });

    const mover = findWindow('Mover');
    if (!mover)
      throw new Error('expected the mover');

    // Without the (now minimized) sibling as a target, the raw position stands.
    await act(async () => {
      drag(mover, -95);
    });

    expect(mover.style.left).toBe('305px');
  });
});
