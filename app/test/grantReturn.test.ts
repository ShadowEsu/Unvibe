import assert from 'node:assert/strict';
import test from 'node:test';
import { GRANT_RETURN_WINDOW_MS, grantReturnApp, heldReviewToRun } from '../src/core/grantReturn';

const pressedAt = Date.UTC(2026, 9, 25, 12, 0, 0);

test('a grant soon after the shortcut press goes back to that app', () => {
  assert.equal(grantReturnApp({ app: 'Cursor', at: pressedAt }, pressedAt + 30_000), 'Cursor');
  assert.equal(grantReturnApp({ app: 'Cursor', at: pressedAt }, pressedAt + GRANT_RETURN_WINDOW_MS), 'Cursor');
});

test('a grant arriving after the window never explains on its own', () => {
  assert.equal(grantReturnApp({ app: 'Cursor', at: pressedAt }, pressedAt + GRANT_RETURN_WINDOW_MS + 1), null);
  assert.equal(grantReturnApp({ app: 'Cursor', at: pressedAt }, pressedAt + 60 * 60_000), null);
});

test('no press, or a clock that went backwards, means no return', () => {
  assert.equal(grantReturnApp(null, pressedAt), null);
  assert.equal(grantReturnApp({ app: 'Cursor', at: pressedAt }, pressedAt - 1), null);
});

test('a clipboard explain asked for before agreeing runs once they agree, within the window', () => {
  const held = { confirm: false, at: pressedAt };
  assert.deepEqual(heldReviewToRun(held, pressedAt + 30_000), held);
  assert.deepEqual(heldReviewToRun(held, pressedAt + GRANT_RETURN_WINDOW_MS), held);
  // An editor link keeps its confirm sheet after the agreement.
  assert.equal(heldReviewToRun({ confirm: true, at: pressedAt }, pressedAt + 1)?.confirm, true);
});

test('a late agreement, no held explain, or a clock that went backwards runs nothing', () => {
  assert.equal(heldReviewToRun({ confirm: false, at: pressedAt }, pressedAt + GRANT_RETURN_WINDOW_MS + 1), null);
  assert.equal(heldReviewToRun(null, pressedAt), null);
  assert.equal(heldReviewToRun({ confirm: false, at: pressedAt }, pressedAt - 1), null);
});
