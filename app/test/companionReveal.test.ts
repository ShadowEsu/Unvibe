import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRevealer, type RevealTarget } from '../src/main/windows';

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

test('a window closed before it painted is left alone', () => {
  const { win, calls, destroy } = fakeWindow();
  const { reveal, revealed } = companionRevealer(win, { maximize: true, front: true, platform: 'win32' });
  destroy();
  reveal();
  assert.deepEqual(calls, []);
  assert.equal(revealed(), false);
});
