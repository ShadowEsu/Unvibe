import test from 'node:test';
import assert from 'node:assert/strict';
import { nextQuizOptionIndex } from '../src/core/quizPicker';

test('quiz option index wraps forward and backward on the edges', () => {
  assert.equal(nextQuizOptionIndex(0, 4, 'ArrowDown'), 1);
  assert.equal(nextQuizOptionIndex(0, 4, 'ArrowUp'), 3);
  assert.equal(nextQuizOptionIndex(3, 4, 'ArrowDown'), 0);
  assert.equal(nextQuizOptionIndex(3, 4, 'ArrowUp'), 2);
});

test('quiz option index starts from the first option when none selected yet', () => {
  assert.equal(nextQuizOptionIndex(-1, 4, 'ArrowDown'), 0);
  assert.equal(nextQuizOptionIndex(-1, 4, 'ArrowUp'), 3);
});

test('quiz option index jumps to Home and End', () => {
  assert.equal(nextQuizOptionIndex(2, 4, 'Home'), 0);
  assert.equal(nextQuizOptionIndex(0, 4, 'End'), 3);
});

test('quiz option index guards empty and single-option lists', () => {
  assert.equal(nextQuizOptionIndex(0, 0, 'ArrowDown'), 0);
  assert.equal(nextQuizOptionIndex(0, 0, 'Home'), 0);
  assert.equal(nextQuizOptionIndex(0, 1, 'ArrowDown'), 0);
  assert.equal(nextQuizOptionIndex(0, 1, 'ArrowUp'), 0);
  assert.equal(nextQuizOptionIndex(-1, 1, 'Home'), 0);
  assert.equal(nextQuizOptionIndex(-1, 1, 'End'), 0);
});
