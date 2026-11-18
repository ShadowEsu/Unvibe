import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { endDragsOnLoss, moveWindowDrag, startWindowDrag } from '../src/main/windows';
import { windowDragHandler } from '../src/renderer/shared/windowDrag';

/** Just enough of a BrowserWindow for the drag state: bounds, setPosition and its events. */
function fakeWindow() {
  const win = Object.assign(new EventEmitter(), {
    webContents: new EventEmitter(),
    bounds: { x: 100, y: 100, width: 320, height: 400 },
    moves: 0,
    isDestroyed: () => false,
    getBounds() { return { ...win.bounds }; },
    setPosition(x: number, y: number) { win.bounds = { ...win.bounds, x, y }; win.moves += 1; },
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

for (const [source, event] of [['window', 'hide'], ['window', 'blur'], ['page', 'render-process-gone'], ['page', 'did-start-loading']] as const) {
  test(`a drag ends when the ${source} emits ${event}: later moves are ignored`, () => {
    const win = fakeWindow();
    startWindowDrag(win as never);
    (source === 'window' ? win : win.webContents).emit(event);
    moveWindowDrag(win as never, 30, -20);
    assert.equal(win.moves, 0);
  });
}

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
