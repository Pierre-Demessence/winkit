import type { StorageLike } from '../src/types';
import { describe, expect, it } from 'vitest';

import { clampPosition, clampSize, DEFAULT_MIN, DEFAULT_POS, DEFAULT_SIZE, parseSavedLayout, readSavedLayout, toPoint, toSize, writeSavedLayout } from '../src/layout';

const BOUNDS = { h: 600, w: 800 };

describe('clampPosition', () => {
  it('leaves a position that already fits untouched', () => {
    expect(clampPosition({ x: 100, y: 50 }, { h: 200, w: 300 }, BOUNDS)).toEqual({ x: 100, y: 50 });
  });

  it('pulls a position back inside the bounds', () => {
    expect(clampPosition({ x: 900, y: 700 }, { h: 200, w: 300 }, BOUNDS)).toEqual({ x: 500, y: 400 });
  });

  it('rejects negative positions', () => {
    expect(clampPosition({ x: -40, y: -10 }, { h: 200, w: 300 }, BOUNDS)).toEqual({ x: 0, y: 0 });
  });

  it('pins a window larger than the bounds to the origin instead of off-screen', () => {
    expect(clampPosition({ x: 120, y: 80 }, { h: 900, w: 1200 }, BOUNDS)).toEqual({ x: 0, y: 0 });
  });
});

describe('clampSize', () => {
  it('caps a size at the bounds', () => {
    expect(clampSize({ h: 900, w: 1200 }, DEFAULT_MIN, BOUNDS)).toEqual({ h: 600, w: 800 });
  });

  it('enforces the minimum size', () => {
    expect(clampSize({ h: 10, w: 10 }, DEFAULT_MIN, BOUNDS)).toEqual({ h: 120, w: 180 });
  });

  it('lets the minimum win when the bounds are smaller than it', () => {
    expect(clampSize({ h: 50, w: 50 }, DEFAULT_MIN, { h: 40, w: 40 })).toEqual({ h: 120, w: 180 });
  });
});

describe('prop validation', () => {
  it('accepts usable points and sizes', () => {
    expect(toPoint({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
    expect(toSize({ h: 50, w: 100 })).toEqual({ h: 50, w: 100 });
  });

  it('rejects non-finite and missing props before they reach a style', () => {
    expect(toPoint({ x: Number.NaN, y: 0 })).toBeUndefined();
    expect(toPoint(undefined)).toBeUndefined();
    expect(toPoint('12,4')).toBeUndefined();
    expect(toSize({ h: 10, w: Number.POSITIVE_INFINITY })).toBeUndefined();
    expect(toSize({ h: 0, w: 0 })).toBeUndefined();
    expect(toSize(null)).toBeUndefined();
  });

  it('ships defaults that survive their own validation', () => {
    expect(toPoint(DEFAULT_POS)).toEqual(DEFAULT_POS);
    expect(toSize(DEFAULT_SIZE)).toEqual(DEFAULT_SIZE);
  });
});

describe('parseSavedLayout', () => {
  it('ignores missing or unparseable input', () => {
    expect(parseSavedLayout(null)).toBeUndefined();
    expect(parseSavedLayout('')).toBeUndefined();
    expect(parseSavedLayout('not json')).toBeUndefined();
    expect(parseSavedLayout('[]')).toBeUndefined();
    expect(parseSavedLayout('null')).toBeUndefined();
  });

  it('round-trips a valid layout', () => {
    const layout = { minimized: true, pos: { x: 12, y: 34 }, size: { h: 200, w: 300 } };
    expect(parseSavedLayout(JSON.stringify(layout))).toEqual(layout);
  });

  it('drops non-finite and wrong-typed numbers rather than trusting them', () => {
    // Hand-edited JSON can carry an out-of-range literal, which parses to Infinity.
    expect(parseSavedLayout('{"pos":{"x":1e999,"y":2}}')?.pos).toBeUndefined();
    // `JSON.stringify` turns Infinity into null, which must be rejected too.
    expect(parseSavedLayout('{"pos":{"x":null,"y":2}}')?.pos).toBeUndefined();
    expect(parseSavedLayout('{"pos":{"x":"12","y":2}}')?.pos).toBeUndefined();
    expect(parseSavedLayout('{"size":{"w":-5,"h":100}}')?.size).toBeUndefined();
    expect(parseSavedLayout('{"size":{"w":100,"h":0}}')?.size).toBeUndefined();
    expect(parseSavedLayout('{"minimized":"yes"}')?.minimized).toBeUndefined();
  });

  it('keeps the valid fields of a partially corrupt layout', () => {
    const parsed = parseSavedLayout('{"pos":{"x":10,"y":20},"size":{"w":"bad","h":5},"minimized":true}');
    expect(parsed).toEqual({ minimized: true, pos: { x: 10, y: 20 } });
  });
});

describe('storage access', () => {
  function memoryStorage(seed?: string): StorageLike & { writeCount: () => number } {
    let value = seed ?? null;
    let writes = 0;
    return {
      getItem: () => value,
      setItem: (_key, next) => {
        value = next;
        writes += 1;
      },
      writeCount: () => writes,
    };
  }

  it('reads a persisted layout back', () => {
    expect(readSavedLayout(memoryStorage('{"pos":{"x":5,"y":6}}'), 'k')).toEqual({ pos: { x: 5, y: 6 } });
  });

  it('writes a layout as JSON', () => {
    const storage = memoryStorage();
    writeSavedLayout(storage, 'k', { minimized: true, pos: { x: 1, y: 2 } });
    expect(storage.writeCount()).toBe(1);
    expect(readSavedLayout(storage, 'k')).toEqual({ minimized: true, pos: { x: 1, y: 2 } });
  });

  it('never throws when storage is blocked', () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error('private mode');
      },
      setItem: () => {
        throw new Error('private mode');
      },
    };
    expect(readSavedLayout(blocked, 'k')).toBeUndefined();
    expect(() => writeSavedLayout(blocked, 'k', { minimized: false })).not.toThrow();
  });

  it('never throws when the quota is full', () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(() => writeSavedLayout(full, 'k', { minimized: false })).not.toThrow();
  });
});
