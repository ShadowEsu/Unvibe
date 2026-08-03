import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTabIndex } from '../src/core/tabs';

test('ArrowRight advances through the tab list', () => {
  assert.equal(nextTabIndex(0, 3, 'ArrowRight'), 1);
  assert.equal(nextTabIndex(1, 3, 'ArrowRight'), 2);
});

test('ArrowRight wraps from the last tab to the first', () => {
  assert.equal(nextTabIndex(2, 3, 'ArrowRight'), 0);
});

test('ArrowLeft moves backwards and wraps', () => {
  assert.equal(nextTabIndex(2, 3, 'ArrowLeft'), 1);
  assert.equal(nextTabIndex(0, 3, 'ArrowLeft'), 2);
});

test('Home and End jump to the first and last tab', () => {
  assert.equal(nextTabIndex(2, 3, 'Home'), 0);
  assert.equal(nextTabIndex(0, 3, 'End'), 2);
});

test('handles a single-tab list without wrapping into nothing', () => {
  assert.equal(nextTabIndex(0, 1, 'ArrowRight'), 0);
  assert.equal(nextTabIndex(0, 1, 'ArrowLeft'), 0);
});

test('guards against an empty tab list', () => {
  assert.equal(nextTabIndex(0, 0, 'ArrowRight'), 0);
});
