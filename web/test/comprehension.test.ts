import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestion } from '../src/ai/comprehension';

const validJson = {
  question: 'What does the reduce function do?',
  options: [
    'Iterates and accumulates a single value',
    'Filters array elements',
    'Maps each element to a new value',
    'Sorts the array in place',
  ],
  answerIndex: 0,
  rationale: 'reduce() takes a callback and initial value, accumulating each iteration into a single result.',
  concept: 'array-reduce',
  conceptLabel: 'Array reduce',
};

test('parseQuestion parses valid JSON input', () => {
  const q = parseQuestion(JSON.stringify(validJson));
  assert.ok(q);
  assert.equal(q.question, validJson.question);
  assert.equal(q.options.length, 4);
  assert.equal(q.answerIndex, 0);
  assert.equal(q.rationale, validJson.rationale);
  assert.equal(q.concept, 'array-reduce');
  assert.equal(q.conceptLabel, 'Array reduce');
});

test('parseQuestion tolerates code fences and surrounding prose', () => {
  const fenced = 'Here is the question:\n```json\n' + JSON.stringify(validJson) + '\n```\nHope this helps.';
  const q = parseQuestion(fenced);
  assert.ok(q);
  assert.equal(q.question, validJson.question);
  assert.equal(q.answerIndex, 0);
});

test('parseQuestion rejects non-integer answerIndex', () => {
  assert.equal(parseQuestion(JSON.stringify({ ...validJson, answerIndex: 0.5 })), undefined);
  assert.equal(parseQuestion(JSON.stringify({ ...validJson, answerIndex: 1.9 })), undefined);
  assert.equal(parseQuestion(JSON.stringify({ ...validJson, answerIndex: NaN })), undefined);
});

test('parseQuestion rejects out-of-range answerIndex', () => {
  assert.equal(parseQuestion(JSON.stringify({ ...validJson, answerIndex: 99 })), undefined);
  assert.equal(parseQuestion(JSON.stringify({ ...validJson, answerIndex: 4 })), undefined);
});

test('parseQuestion rejects negative answerIndex', () => {
  assert.equal(parseQuestion(JSON.stringify({ ...validJson, answerIndex: -1 })), undefined);
});

test('parseQuestion returns undefined for empty or non-JSON input', () => {
  assert.equal(parseQuestion(''), undefined);
  assert.equal(parseQuestion('not json'), undefined);
  assert.equal(parseQuestion('{}'), undefined);
});

test('parseQuestion returns undefined when question field is missing', () => {
  const { question: _, ...rest } = validJson;
  assert.equal(parseQuestion(JSON.stringify(rest)), undefined);
});

test('parseQuestion returns undefined for non-array options', () => {
  assert.equal(parseQuestion(JSON.stringify({ ...validJson, options: 'not-array' })), undefined);
});

test('parseQuestion returns undefined for fewer than 2 options', () => {
  assert.equal(parseQuestion(JSON.stringify({ ...validJson, options: ['only one'] })), undefined);
});

test('parseQuestion defaults missing concept fields', () => {
  const { concept: _, conceptLabel: __, ...rest } = validJson;
  const q = parseQuestion(JSON.stringify(rest));
  assert.ok(q);
  assert.equal(q.concept, 'general');
  assert.equal(q.conceptLabel, 'General');
});

test('parseQuestion defaults missing rationale to empty string', () => {
  const { rationale: _, ...rest } = validJson;
  const q = parseQuestion(JSON.stringify(rest));
  assert.ok(q);
  assert.equal(q.rationale, '');
});
