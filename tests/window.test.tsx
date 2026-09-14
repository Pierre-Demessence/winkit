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
