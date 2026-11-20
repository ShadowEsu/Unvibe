import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { settings } from '../src/main/settings';
import { NUDGE_SAVE_MS, endDragsOnLoss, endPanelDrag, keepWindowOnDisplays, moveWindowDrag, nudgePanel, resetPanelPosition, startWindowDrag } from '../src/main/windows';
import { windowDragHandler } from '../src/renderer/shared/windowDrag';

// This file gets its own userData, so the spots it reads are only its own.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-drag-loss-'));
app.getPath = (): string => userData;

/** Just enough of a BrowserWindow for the drag state: bounds, setPosition and its events. */
function fakeWindow() {
  const win = Object.assign(new EventEmitter(), {
    webContents: new EventEmitter(),
    bounds: { x: 100, y: 100, width: 320, height: 400 },
    moves: 0,
    isDestroyed: () => false,
    getBounds() { return { ...win.bounds }; },
    setPosition(x: number, y: number) { win.bounds = { ...win.bounds, x, y }; win.moves += 1; },
    setBounds(b: { x: number; y: number; width: number; height: number }) { win.bounds = { ...b }; win.moves += 1; },
  });
  endDragsOnLoss(win as never);
  return win;
}

test('a drag in progress moves its window', () => {
  const win = fakeWindow();
  startWindowDrag(win as never);
  moveWindowDrag(win as never, 30, -20);
  assert.deepEqual([win.bounds.x, win.bounds.y], [130, 80]);
});

test('a drag ignores a move that is NaN, infinite, past 20,000 px or not a number', () => {
  for (const bad of [Number.NaN, Infinity, -Infinity, 20_001, -20_001, '5']) {
    const win = fakeWindow();
    startWindowDrag(win as never);
    moveWindowDrag(win as never, bad as number, 0);
    moveWindowDrag(win as never, 0, bad as number);
    assert.equal(win.moves, 0, String(bad));
    assert.deepEqual([win.bounds.x, win.bounds.y], [100, 100], String(bad));
  }
});

test('each drag move keeps the window\'s centre on a display, even with no drop to follow (Security S3)', () => {
  const win = fakeWindow();
  startWindowDrag(win as never);
  moveWindowDrag(win as never, -5000, 20_000);
  assert.deepEqual([win.bounds.x, win.bounds.y], [-160, 800], 'the centre stops at the 1600 × 1000 display\'s corner');
  moveWindowDrag(win as never, 20_000, -20_000);
  assert.deepEqual([win.bounds.x, win.bounds.y], [1600 - 160, -200]);
  moveWindowDrag(win as never, 500, 300);
  assert.deepEqual([win.bounds.x, win.bounds.y], [600, 400], 'a move on screen is not changed');
});

for (const [source, event] of [['window', 'hide'], ['window', 'blur'], ['page', 'render-process-gone'], ['page', 'did-start-loading']] as const) {
  test(`a drag ends when the ${source} emits ${event}: later moves are ignored`, () => {
    const win = fakeWindow();
    startWindowDrag(win as never);
    (source === 'window' ? win : win.webContents).emit(event);
    moveWindowDrag(win as never, 30, -20);
    assert.equal(win.moves, 0);
  });
}

test('a drag that loses its window mid-way comes back on screen, and a drop that arrives after saves no spot', () => {
  const win = fakeWindow();
  startWindowDrag(win as never);
  moveWindowDrag(win as never, -600, 2000);
  win.emit('blur');
  assert.deepEqual([win.bounds.x, win.bounds.y], [12, 1000 - 400 - 12], 'inside the 1600 × 1000 work area, 12 px in');
  endPanelDrag(win as never);
  assert.deepEqual(settings().all().overlaySpots ?? {}, {});
});

test('an overlay left on an unplugged display comes back whole onto the nearest one, and nothing is saved', () => {
  const win = fakeWindow();
  win.bounds = { ...win.bounds, x: 2000, y: 100 };
  keepWindowOnDisplays(win as never);
  assert.deepEqual([win.bounds.x, win.bounds.y], [1600 - 320 - 12, 100], 'inside the 1600 × 1000 work area, 12 px in');
  assert.deepEqual(settings().all().overlaySpots ?? {}, {});
});

test('after a display change, a window whose centre is still on a display, or one mid-drag, stays where it is', () => {
  const partlyOff = fakeWindow();
  partlyOff.bounds = { ...partlyOff.bounds, x: 1400, y: 100 };
  keepWindowOnDisplays(partlyOff as never);
  assert.deepEqual([partlyOff.bounds.x, partlyOff.moves], [1400, 0]);

  const dragging = fakeWindow();
  startWindowDrag(dragging as never);
  dragging.bounds = { ...dragging.bounds, x: 2000 };
  keepWindowOnDisplays(dragging as never);
  assert.deepEqual([dragging.bounds.x, dragging.moves], [2000, 0]);
  dragging.emit('blur');
});

/** A pointer surface for the page-side handler (no DOM in node). */
function surface() {
  const el = Object.assign(new EventTarget(), {
    captured: false,
    setPointerCapture() { el.captured = true; },
    hasPointerCapture() { return el.captured; },
    releasePointerCapture() { el.captured = false; },
  });
  return el;
}
const pointer = (type: string, screenX = 0, screenY = 0) => Object.assign(new Event(type), { pointerId: 1, screenX, screenY });

test('the page ends a drag once when it loses the pointer, and a release after that does nothing more', () => {
  const g = globalThis as Record<string, unknown>;
  g.window ??= new EventTarget();
  g.requestAnimationFrame ??= (cb: () => void) => setTimeout(cb, 0);
  g.cancelAnimationFrame ??= (id: ReturnType<typeof setTimeout>) => clearTimeout(id);
  const calls: string[] = [];
  const el = surface();
  const down = windowDragHandler({ start: () => calls.push('start'), move: (dx, dy) => calls.push(`move ${dx},${dy}`), end: () => calls.push('end') });
  down({ button: 0, isPrimary: true, target: null, currentTarget: el, pointerId: 1, screenX: 0, screenY: 0 } as never);
  el.dispatchEvent(pointer('pointermove', 2, 0));
  assert.deepEqual(calls, [], 'under 4 px it is still a click');
  el.dispatchEvent(pointer('pointermove', 40, 10));
  el.dispatchEvent(pointer('lostpointercapture'));
  el.dispatchEvent(pointer('pointerup', 40, 10));
  assert.deepEqual(calls, ['start', 'move 40,10', 'end']);
});

const savedOverlaySpot = () => settings().all().overlaySpots?.['1'];

test('a held arrow key moves the panel at once and saves its spot once, 500 ms after the last nudge (Security S1)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const set = t.mock.method(settings(), 'set');
  const win = fakeWindow();
  for (let i = 0; i < 5; i += 1) nudgePanel(win as never, 1, 0);
  assert.deepEqual([win.bounds.x, win.bounds.y], [180, 100]);
  t.mock.timers.tick(NUDGE_SAVE_MS - 1);
  assert.equal(set.mock.callCount(), 0, 'no write while the key repeats');
  t.mock.timers.tick(1);
  assert.equal(set.mock.callCount(), 1);
  assert.deepEqual(savedOverlaySpot(), { x: 180, y: 100 });
  // Over and back: the spot is the saved one, so the file isn't written again.
  nudgePanel(win as never, 1, 0);
  nudgePanel(win as never, -1, 0);
  t.mock.timers.tick(NUDGE_SAVE_MS);
  assert.equal(set.mock.callCount(), 1);
});

test('a nudge save still waiting never overwrites a drop or a double-click reset', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const win = fakeWindow();
  nudgePanel(win as never, 0, 1);
  startWindowDrag(win as never);
  moveWindowDrag(win as never, 300, 0);
  endPanelDrag(win as never);
  assert.deepEqual(savedOverlaySpot(), { x: 400, y: 116 }, 'a drop saves at once');
  t.mock.timers.tick(NUDGE_SAVE_MS);
  assert.deepEqual(savedOverlaySpot(), { x: 400, y: 116 }, 'the drop stands');
  nudgePanel(win as never, 1, 0);
  resetPanelPosition(win as never);
  assert.equal(savedOverlaySpot(), undefined);
  t.mock.timers.tick(NUDGE_SAVE_MS);
  assert.equal(savedOverlaySpot(), undefined, 'the reset stands');
});
