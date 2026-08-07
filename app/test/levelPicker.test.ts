import test from 'node:test';
import assert from 'node:assert/strict';
import { nextLevelIndex } from '../src/core/levelPicker';

test('level index wraps forward and backward on the edges', () => {
  assert.equal(nextLevelIndex(0, 5, 'ArrowLeft'), 4);
  assert.equal(nextLevelIndex(0, 5, 'ArrowRight'), 1);
  assert.equal(nextLevelIndex(4, 5, 'ArrowRight'), 0);
  assert.equal(nextLevelIndex(4, 5, 'ArrowLeft'), 3);
});

test('level index jumps to Home and End', () => {
  assert.equal(nextLevelIndex(3, 5, 'Home'), 0);
  assert.equal(nextLevelIndex(0, 5, 'End'), 4);
});

test('level index skips locked levels', () => {
  const locked = (i: number) => i === 4;
  assert.equal(nextLevelIndex(0, 5, 'ArrowRight', locked), 1);
  assert.equal(nextLevelIndex(3, 5, 'ArrowRight', locked), 0);
  assert.equal(nextLevelIndex(0, 5, 'ArrowLeft', locked), 3);
  assert.equal(nextLevelIndex(0, 5, 'End', locked), 3);
});

test('level index guards empty and single-level lists', () => {
  assert.equal(nextLevelIndex(0, 0, 'ArrowRight'), 0);
  assert.equal(nextLevelIndex(0, 0, 'Home'), 0);
  assert.equal(nextLevelIndex(0, 1, 'ArrowRight'), 0);
  assert.equal(nextLevelIndex(0, 1, 'ArrowLeft'), 0);
  assert.equal(nextLevelIndex(0, 1, 'Home'), 0);
  assert.equal(nextLevelIndex(0, 1, 'End'), 0);
});

test('level index keeps current when every option is locked', () => {
  const lockedAll = () => true;
  assert.equal(nextLevelIndex(2, 5, 'ArrowRight', lockedAll), 2);
  assert.equal(nextLevelIndex(2, 5, 'ArrowLeft', lockedAll), 2);
  assert.equal(nextLevelIndex(2, 5, 'Home', lockedAll), 0);
  assert.equal(nextLevelIndex(2, 5, 'End', lockedAll), 4);
});
