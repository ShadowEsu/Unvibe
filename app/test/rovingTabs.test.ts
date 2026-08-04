import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRovingIndex } from '../src/core/rovingTabs';

test('roving index wraps forward and backward on the edges', () => {
  assert.equal(nextRovingIndex(0, 3, 'ArrowLeft'), 2);
  assert.equal(nextRovingIndex(0, 3, 'ArrowRight'), 1);
  assert.equal(nextRovingIndex(2, 3, 'ArrowRight'), 0);
  assert.equal(nextRovingIndex(2, 3, 'ArrowLeft'), 1);
});

test('roving index jumps to Home and End', () => {
  assert.equal(nextRovingIndex(2, 3, 'Home'), 0);
  assert.equal(nextRovingIndex(0, 3, 'End'), 2);
});

test('roving index guards empty and single-tab lists', () => {
  assert.equal(nextRovingIndex(0, 0, 'ArrowRight'), 0);
  assert.equal(nextRovingIndex(0, 0, 'Home'), 0);
  assert.equal(nextRovingIndex(0, 1, 'ArrowRight'), 0);
  assert.equal(nextRovingIndex(0, 1, 'ArrowLeft'), 0);
});
