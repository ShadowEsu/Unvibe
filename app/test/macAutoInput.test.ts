import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { MAC_AUTO_INPUT } from '../src/main/selection';

/**
 * Runs the Mac input check's JXA against a stand-in for the HID system: press counts (key-down 10, left 1, right 3),
 * uptime, and HIDIdleTime from the last input. Each ioreg call takes 30 ms of uptime.
 */
function check(mark: string, now: { keys: number; left: number; right: number; uptime: number; lastInput: number }): string {
  let uptime = now.uptime;
  const counts: Record<number, number> = { 10: now.keys, 1: now.left, 3: now.right };
  const $ = Object.assign(() => ({}), {
    NSProcessInfo: { processInfo: { get systemUptime() { return uptime; } } },
    CGEventSourceCounterForEventType: (state: number, type: number) => {
      assert.equal(state, 1, 'HID system state');
      return counts[type];
    },
  });
  const me = {
    doShellScript() {
      const idle = uptime - now.lastInput;
      uptime += 0.03;
      return `| "HIDIdleTime" = ${Math.round(idle * 1e9)}\n`;
    },
  };
  const ctx = vm.createContext({ $, ObjC: { import() {} }, Application: { currentApplication: () => me } });
  return vm.runInContext(`${MAC_AUTO_INPUT}\nrun(${JSON.stringify([mark])});`, ctx) as string;
}

// The mark: the post-copy HIDIdleTime sample (uptime 100.08 to 100.11, the ⌘C at 100.05 was the last input) and the
// press counts taken with the idle sample before the ⌘C.
const mark = [100.08, 100.11, 0.03, 500, 40, 2].join(',');
const settled = { keys: 500, left: 40, right: 2, uptime: 100.4, lastInput: 100.05 };

test('Mac: a settled selection is kept when the counts moved only by the System Events Cmd+C, which adds no key-down (QA X9a)', () => {
  assert.equal(check(mark, settled), 'idle');
});

test('Mac: any key-down or click since the idle sample drops the result, even with no input after the mark (Security MUST-A5)', () => {
  assert.equal(check(mark, { ...settled, keys: 501 }), 'input', 'a key, e.g. a paste before the copy landed');
  assert.equal(check(mark, { ...settled, left: 41 }), 'input', 'a left click');
  assert.equal(check(mark, { ...settled, right: 3 }), 'input', 'a right click');
  assert.equal(check(mark, { ...settled, lastInput: 100.3 }), 'input', 'input after the mark (pointer movement)');
});
