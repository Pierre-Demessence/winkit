import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Window } from '../../src/Window';
import { WindowLayer } from '../../src/WindowLayer';

// React only guarantees that effects have flushed inside `act` when it knows it
// is running under a test harness.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

async function renderLayer(children: ReactNode): Promise<void> {
  await act(async () => {
    root.render(<WindowLayer className="host-layer">{children}</WindowLayer>);
  });
}

/**
 * React's synthetic pointer handlers read the MouseEvent fields plus `pointerId`,
 * which is attached here because jsdom has no PointerEvent.
 */
function pointerEvent(type: string, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, button: 0, ...init });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

function floatingWindow(): HTMLElement | null {
  return host.querySelector<HTMLElement>('.wk-window');
}

function leftOfWindow(): number {
  return Number.parseFloat(floatingWindow()?.style.left ?? '0');
}

describe('react host', () => {
  it('renders the layer with the className alias, the window and its content', async () => {
    await renderLayer(
      <Window title="Inventory" open>
        <p>Body</p>
      </Window>,
    );

    expect(host.querySelector('.wk-layer.host-layer')).not.toBeNull();
    expect(floatingWindow()).not.toBeNull();
    expect(host.querySelector('.wk-body')?.textContent).toBe('Body');
  });

  it('toggles minimization through React state', async () => {
    await renderLayer(
      <Window title="Inventory" open>
        <p>Body</p>
      </Window>,
    );

    const minimize = host.querySelector<HTMLButtonElement>('button[aria-label="Minimize window"]');
    await act(async () => {
      minimize?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(host.querySelector('.wk-body')).toBeNull();
  });

  it('moves the window on a pointer drag', async () => {
    await renderLayer(
      <Window title="Inventory" open>
        <p>Body</p>
      </Window>,
    );

    const before = leftOfWindow();
    const title = host.querySelector<HTMLElement>('.wk-title');

    await act(async () => {
      title?.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
    });
    await act(async () => {
      window.dispatchEvent(pointerEvent('pointermove', { clientX: 60, clientY: 40 }));
    });

    expect(leftOfWindow()).toBeGreaterThan(before);
  });
});
