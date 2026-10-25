import assert from 'node:assert/strict';
import test from 'node:test';
import { isLevelAnswer, levelAfterAnswer } from '../src/core/levelAnswer';

test('too basic steps up one level, too advanced steps down one, about right keeps it', () => {
  assert.equal(levelAfterAnswer('intermediate', 'too_basic'), 'advanced');
  assert.equal(levelAfterAnswer('intermediate', 'too_advanced'), 'beginner');
  assert.equal(levelAfterAnswer('intermediate', 'about_right'), 'intermediate');
  assert.equal(levelAfterAnswer('beginner', 'too_advanced'), 'new');
});

test('the first-run question never steps into Expert, which is Pro', () => {
  assert.equal(levelAfterAnswer('advanced', 'too_basic'), 'advanced');
  assert.equal(levelAfterAnswer('new', 'too_advanced'), 'new');
  assert.equal(levelAfterAnswer('expert', 'too_basic'), 'expert');
  assert.equal(levelAfterAnswer('expert', 'too_advanced'), 'advanced');
});

test('only the three answers are accepted from the renderer', () => {
  assert.equal(isLevelAnswer('too_basic'), true);
  assert.equal(isLevelAnswer('expert'), false);
  assert.equal(isLevelAnswer(undefined), false);
});
