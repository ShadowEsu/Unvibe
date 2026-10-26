import assert from 'node:assert/strict';
import test from 'node:test';
import { GRANT_RETURN_WINDOW_MS, grantReturnApp } from '../src/core/grantReturn';

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
