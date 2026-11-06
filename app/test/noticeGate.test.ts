import test from 'node:test';
import assert from 'node:assert/strict';
import { noticeGate } from '../src/main/notify';

const INFO = false;
const PROBLEM = true;

test('a problem right after an information notice still reaches the Island', () => {
  const admit = noticeGate(15_000);
  assert.equal(admit(INFO, 0), true, '"3 files changed in my-app"');
  assert.equal(admit(PROBLEM, 4_000), true, '"Couldn\'t copy from Notepad…" must not be rate-limited away');
});

test('an information notice never replaces a problem inside the window, and waits 15 s after it', () => {
  const admit = noticeGate(15_000);
  assert.equal(admit(PROBLEM, 0), true);
  assert.equal(admit(INFO, 5_000), false);
  assert.equal(admit(INFO, 14_999), false);
  assert.equal(admit(INFO, 15_000), true);
});

test('an information notice after a pre-empting problem waits for the problem, not the earlier information', () => {
  const admit = noticeGate(15_000);
  assert.equal(admit(INFO, 0), true);
  assert.equal(admit(PROBLEM, 10_000), true);
  assert.equal(admit(INFO, 16_000), false, '6 s after the problem');
  assert.equal(admit(INFO, 25_000), true);
});

test('repeats of the same kind stay rate-limited to one per 15 s', () => {
  const admit = noticeGate(15_000);
  assert.equal(admit(PROBLEM, 0), true);
  assert.equal(admit(PROBLEM, 3_000), false, 'a second problem 3 s later');
  assert.equal(admit(PROBLEM, 15_000), true);
  assert.equal(admit(INFO, 40_000), true);
  assert.equal(admit(INFO, 50_000), false);
});
