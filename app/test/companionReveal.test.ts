import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { armCompanionReveal, companionRevealer, type RevealTarget } from '../src/main/windows';
import { signalFirstScreen, type FrameClock } from '../src/renderer/companion/firstScreen';

/** A stand-in companion window that records, in order, what the reveal did to it. */
function fakeWindow() {
  const calls: string[] = [];
  let destroyed = false;
  const win: RevealTarget = {
    isDestroyed: () => destroyed,
    maximize: () => { calls.push('maximize'); },
    show: () => { calls.push('show'); },
    setAlwaysOnTop: ((flag: boolean) => { calls.push(`top:${flag}`); }) as RevealTarget['setAlwaysOnTop'],
    moveTop: () => { calls.push('moveTop'); },
    focus: () => { calls.push('focus'); },
  };
  return { win, calls, destroy: () => { destroyed = true; } };
}

test('a first-run window the user opened on Windows is maximized before it shows, then put above other windows', () => {
  const { win, calls } = fakeWindow();
  const { reveal, revealed } = companionRevealer(win, { maximize: true, front: true, platform: 'win32' });
  assert.equal(revealed(), false);
  reveal();
  assert.deepEqual(calls, ['maximize', 'show', 'top:true', 'top:false', 'moveTop', 'focus']);
  assert.equal(revealed(), true);
});

test('the paint and the 5 s fallback both calling reveal show the window once', () => {
  const { win, calls } = fakeWindow();
  const { reveal } = companionRevealer(win, { maximize: true, front: true, platform: 'darwin' });
  reveal();
  reveal();
  // macOS: no topmost toggle; one show, one focus.
  assert.deepEqual(calls, ['maximize', 'show', 'moveTop', 'focus']);
});

test('a window not asked to come to the front shows where it is, unmaximized after setup, and takes no focus', () => {
  const { win, calls } = fakeWindow();
  companionRevealer(win, { maximize: false, front: false, platform: 'win32' }).reveal();
  assert.deepEqual(calls, ['show']);
});

test('a window closed before its first screen is left alone', () => {
  const { win, calls, destroy } = fakeWindow();
  const { reveal, revealed } = companionRevealer(win, { maximize: true, front: true, platform: 'win32' });
  destroy();
  reveal();
  assert.deepEqual(calls, []);
  assert.equal(revealed(), false);
});

// #208: the window shows on the page's first-screen signal, or after 5 s; never on Chromium's ready-to-show, which
// fires on the empty frame the page draws while it reads its settings.
test('a hidden companion is not shown on ready-to-show, only by the fallback 5 s later when no signal came', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const win = new EventEmitter();
  let reveals = 0;
  armCompanionReveal(win, () => { reveals += 1; });
  win.emit('ready-to-show');
  t.mock.timers.tick(4999);
  assert.equal(reveals, 0);
  t.mock.timers.tick(1);
  assert.equal(reveals, 1);
});

test('once the companion has shown, or closed, the fallback never fires', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const event of ['show', 'closed']) {
    const win = new EventEmitter();
    let reveals = 0;
    armCompanionReveal(win, () => { reveals += 1; });
    t.mock.timers.tick(200);
    win.emit(event);
    t.mock.timers.tick(10_000);
    assert.equal(reveals, 0, event);
  }
});

/** A frame clock the test steps by hand: `frame()` runs the callbacks waiting for the next frame. */
function manualClock() {
  let next = 1;
  let frames = new Map<number, () => void>();
  const timers = new Map<number, { cb: () => void; at: number }>();
  let now = 0;
  const clock: FrameClock = {
    raf: (cb) => { frames.set(next, cb); return next++; },
    cancelRaf: (id) => { frames.delete(id); },
    setTimer: (cb, ms) => { timers.set(next, { cb, at: now + ms }); return next++; },
    clearTimer: (id) => { timers.delete(id); },
  };
  const frame = () => { const due = frames; frames = new Map(); for (const cb of due.values()) cb(); };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.cb(); }
  };
  return { clock, frame, advance };
}

test('the first-screen signal goes on the second frame, once, and the timer then stays quiet', () => {
  const { clock, frame, advance } = manualClock();
  let sends = 0;
  signalFirstScreen(() => { sends += 1; }, 120, clock);
  frame();
  assert.equal(sends, 0);
  frame();
  assert.equal(sends, 1);
  advance(500);
  frame();
  assert.equal(sends, 1);
});

test('a hidden page that gets no frames still signals once its timer runs out', () => {
  const { clock, frame, advance } = manualClock();
  let sends = 0;
  signalFirstScreen(() => { sends += 1; }, 120, clock);
  advance(119);
  assert.equal(sends, 0);
  advance(1);
  assert.equal(sends, 1);
  frame();
  frame();
  assert.equal(sends, 1);
});

test('a screen replaced before either fired still signals, once, when it is cleaned up', () => {
  const { clock, frame, advance } = manualClock();
  let sends = 0;
  const cleanup = signalFirstScreen(() => { sends += 1; }, 120, clock);
  cleanup();
  assert.equal(sends, 1);
  cleanup();
  frame();
  frame();
  advance(500);
  assert.equal(sends, 1);
});
