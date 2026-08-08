import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidComprehensionQuestion } from '../src/core/protocol';

const valid = {
  question: 'What does this code do?',
  options: ['It sorts the list', 'It deletes the file', 'It opens a socket', 'It logs the error'],
  answerIndex: 0,
  rationale: 'It sorts the list.',
  concept: 'sorting',
  conceptLabel: 'Sorting',
};

test('accepts a well-formed comprehension question', () => {
  assert.equal(isValidComprehensionQuestion(valid), true);
});

test('rejects float and out-of-range answerIndex so grading cannot be corrupted', () => {
  assert.equal(isValidComprehensionQuestion({ ...valid, answerIndex: 1.5 }), false);
  assert.equal(isValidComprehensionQuestion({ ...valid, answerIndex: 4 }), false);
  assert.equal(isValidComprehensionQuestion({ ...valid, answerIndex: -1 }), false);
  assert.equal(isValidComprehensionQuestion({ ...valid, answerIndex: '0' }), false);
});

test('rejects empty or duplicate options', () => {
  assert.equal(isValidComprehensionQuestion({ ...valid, options: ['a', 'a', 'b', 'c'] }), false);
  assert.equal(isValidComprehensionQuestion({ ...valid, options: ['a', '', 'b', 'c'] }), false);
  assert.equal(isValidComprehensionQuestion({ ...valid, options: ['a'] }), false);
});

test('rejects missing or blank question and non-string fields', () => {
  assert.equal(isValidComprehensionQuestion({ ...valid, question: '' }), false);
  assert.equal(isValidComprehensionQuestion({ ...valid, rationale: 42 }), false);
  assert.equal(isValidComprehensionQuestion({ ...valid, concept: null }), false);
  assert.equal(isValidComprehensionQuestion(undefined), false);
  assert.equal(isValidComprehensionQuestion(null), false);
  assert.equal(isValidComprehensionQuestion('not an object'), false);
});
