import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestion } from '../src/ai/comprehension';

test('parseQuestion returns a valid question from clean JSON', () => {
  const q = parseQuestion('{"question":"What does this do?","options":["A","B","C","D"],"answerIndex":0,"rationale":"Because","concept":"testing","conceptLabel":"Testing"}');
  assert.ok(q);
  assert.equal(q!.question, 'What does this do?');
  assert.equal(q!.answerIndex, 0);
  assert.equal(q!.concept, 'testing');
});

test('parseQuestion tolerates code fences and surrounding prose', () => {
  const q = parseQuestion('Here is the question:\n```json\n{"question":"Q?","options":["X","Y"],"answerIndex":1,"rationale":"R","concept":"c","conceptLabel":"C"}\n```\nHope this helps.');
  assert.ok(q);
  assert.equal(q!.question, 'Q?');
  assert.equal(q!.answerIndex, 1);
});

test('parseQuestion rejects non-integer answerIndex', () => {
  const q = parseQuestion('{"question":"Q?","options":["A","B"],"answerIndex":0.5,"rationale":"R","concept":"c","conceptLabel":"C"}');
  assert.equal(q, undefined);
});

test('parseQuestion rejects out-of-range answerIndex', () => {
  const q = parseQuestion('{"question":"Q?","options":["A","B"],"answerIndex":5,"rationale":"R","concept":"c","conceptLabel":"C"}');
  assert.equal(q, undefined);
});

test('parseQuestion rejects negative answerIndex', () => {
  const q = parseQuestion('{"question":"Q?","options":["A","B"],"answerIndex":-1,"rationale":"R","concept":"c","conceptLabel":"C"}');
  assert.equal(q, undefined);
});

test('parseQuestion returns undefined for invalid JSON', () => {
  assert.equal(parseQuestion('not json'), undefined);
  assert.equal(parseQuestion('{}'), undefined);
  assert.equal(parseQuestion(''), undefined);
});

test('parseQuestion defaults missing concept fields', () => {
  const q = parseQuestion('{"question":"Q?","options":["A","B"],"answerIndex":0,"rationale":"R"}');
  assert.ok(q);
  assert.equal(q!.concept, 'general');
  assert.equal(q!.conceptLabel, 'General');
});

test('parseQuestion rejects non-array options', () => {
  const q = parseQuestion('{"question":"Q?","options":"not-array","answerIndex":0,"rationale":"R","concept":"c","conceptLabel":"C"}');
  assert.equal(q, undefined);
});
