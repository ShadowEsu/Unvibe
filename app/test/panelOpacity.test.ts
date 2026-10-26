import test from 'node:test';
import assert from 'node:assert/strict';
import { setPanelOpacity, type DimmablePanel } from '../src/main/windows';

/**
 * A stand-in review panel. Stylesheet calls settle after some microtask turns (the first one slowest,
 * no timers), and the fake records what the page would show and whether two calls ever overlapped.
 */
function fakePanel() {
  const opacityCalls: number[] = [];
  const sheets = new Map<string, string>();
  let nextKey = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  let destroyed = false;
  let contentsDestroyed = false;
  const settle = async <T>(turns: number, apply: () => T): Promise<T> => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    for (let i = 0; i < turns; i++) await null;
    inFlight -= 1;
    return apply();
  };
  const panel: DimmablePanel = {
    isDestroyed: () => destroyed,
    setOpacity: (value: number) => { opacityCalls.push(value); },
    webContents: {
      isDestroyed: () => contentsDestroyed,
      insertCSS: (css: string) => settle(nextKey === 0 ? 20 : 1, () => {
        const key = `sheet-${nextKey++}`;
        sheets.set(key, css);
        return key;
      }),
      removeInsertedCSS: (key: string) => settle(1, () => { sheets.delete(key); }),
    },
  };
  return {
    panel,
    opacityCalls,
    /** The opacity the page shows: 1 unless a dimming stylesheet is in place. */
    pageOpacity: () => {
      const css = [...sheets.values()].at(-1);
      return css ? Number(/opacity: ([\d.]+)/.exec(css)?.[1]) : 1;
    },
    sheetCount: () => sheets.size,
    maxInFlight: () => maxInFlight,
    destroy: () => { destroyed = true; },
    destroyContents: () => { contentsDestroyed = true; },
  };
}

test('on Windows the panel never uses window opacity, and a quick blur then focus ends undimmed', async () => {
  const fake = fakePanel();
  // Blur dims, focus undims straight away, before the slow first stylesheet has landed.
  // Both calls must have finished before the page is checked, so a late dim cannot hide.
  await Promise.all([setPanelOpacity(fake.panel, 0.72, 'win32'), setPanelOpacity(fake.panel, 1, 'win32')]);
  assert.deepEqual(fake.opacityCalls, [], 'win32 must not call setOpacity: it freezes a transparent window');
  assert.equal(fake.pageOpacity(), 1, 'the page ends undimmed');
  assert.equal(fake.sheetCount(), 0);
  assert.equal(fake.maxInFlight(), 1, 'stylesheet changes run one after another');

  await setPanelOpacity(fake.panel, 0.72, 'win32');
  assert.equal(fake.pageOpacity(), 0.72, 'a blur dims the page');
  assert.equal(fake.sheetCount(), 1, 'a new dim replaces the old one');
  await setPanelOpacity(fake.panel, 0.5, 'win32');
  assert.equal(fake.pageOpacity(), 0.5);
  assert.equal(fake.sheetCount(), 1);
  await setPanelOpacity(fake.panel, 1, 'win32');
  assert.equal(fake.pageOpacity(), 1);
  assert.deepEqual(fake.opacityCalls, []);
});

test('on Windows a saved opacity is clamped before it reaches the page', async () => {
  const fake = fakePanel();
  await setPanelOpacity(fake.panel, 0.05, 'win32');
  assert.equal(fake.pageOpacity(), 0.35);
  await setPanelOpacity(fake.panel, Number.NaN, 'win32');
  assert.equal(fake.pageOpacity(), 1);
  await setPanelOpacity(fake.panel, 7, 'win32');
  assert.equal(fake.pageOpacity(), 1);
  assert.equal(fake.sheetCount(), 0);
});

test('on Windows a closed panel is left alone', async () => {
  const closed = fakePanel();
  closed.destroy();
  await setPanelOpacity(closed.panel, 0.72, 'win32');
  assert.equal(closed.sheetCount(), 0);
  const gone = fakePanel();
  gone.destroyContents();
  await setPanelOpacity(gone.panel, 0.72, 'win32');
  assert.equal(gone.sheetCount(), 0);
  assert.deepEqual([...closed.opacityCalls, ...gone.opacityCalls], []);
});

test('on macOS the panel keeps using window opacity with the same values as before', async () => {
  const fake = fakePanel();
  await setPanelOpacity(fake.panel, 0.72, 'darwin');
  await setPanelOpacity(fake.panel, 1, 'darwin');
  await setPanelOpacity(fake.panel, 0.2, 'darwin');
  assert.deepEqual(fake.opacityCalls, [0.72, 1, 0.2]);
  assert.equal(fake.sheetCount(), 0, 'macOS does not dim the page');
  const closed = fakePanel();
  closed.destroy();
  await setPanelOpacity(closed.panel, 0.72, 'darwin');
  assert.deepEqual(closed.opacityCalls, []);
});
