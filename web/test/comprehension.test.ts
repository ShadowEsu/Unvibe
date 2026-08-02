import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestion } from '../src/ai/comprehension';

const VALID = JSON.stringify({
  question: 'What does this function return?',
  options: ['the sum', 'the product', 'the difference', 'the quotient'],
  answerIndex: 0,
  rationale: 'The reduce callback accumulates a sum.',
  concept: 'array-reduce',
  conceptLabel: 'Array reduce',
});

test('parseQuestion accepts a well-formed question', () => {
  const q = parseQuestion(VALID);
  assert.ok(q);
  assert.equal(q.question, 'What does this function return?');
  assert.equal(q.answerIndex, 0);
  assert.equal(q.concept, 'array-reduce');
});

test('parseQuestion tolerates code fences and surrounding prose', () => {
  const q = parseQuestion(`Here you go:\n\`\`\`json\n${VALID}\n\`\`\`\nHope that helps.`);
  assert.ok(q);
  assert.equal(q.options.length, 4);
});

test('parseQuestion rejects duplicate options (ambiguous grading)', () => {
  const withDup = JSON.stringify({
    question: 'What does this function return?',
    options: ['the sum', 'the sum', 'the difference', 'the quotient'],
    answerIndex: 0,
    rationale: 'The reduce callback accumulates a sum.',
    concept: 'array-reduce',
    conceptLabel: 'Array reduce',
  });
  assert.equal(parseQuestion(withDup), undefined);
});

test('parseQuestion rejects options that differ only by case or whitespace', () => {
  const caseDup = JSON.stringify({
    question: 'What does this function return?',
    options: ['The Sum', 'the sum', 'the difference', 'the quotient'],
    answerIndex: 0,
    rationale: '',
    concept: 'x',
    conceptLabel: 'X',
  });
  assert.equal(parseQuestion(caseDup), undefined);
  const wsDup = JSON.stringify({
    question: 'What does this function return?',
    options: ['the sum', '  the sum  ', 'the difference', 'the quotient'],
    answerIndex: 0,
    rationale: '',
    concept: 'x',
    conceptLabel: 'X',
  });
  assert.equal(parseQuestion(wsDup), undefined);
});

test('parseQuestion rejects empty options after trimming', () => {
  const empty = JSON.stringify({
    question: 'What does this function return?',
    options: ['', 'the product', 'the difference', 'the quotient'],
    answerIndex: 0,
    rationale: '',
    concept: 'x',
    conceptLabel: 'X',
  });
  assert.equal(parseQuestion(empty), undefined);
});

test('parseQuestion rejects an answerIndex outside the option range', () => {
  const bad = JSON.stringify({
    question: 'What does this function return?',
    options: ['the sum', 'the product', 'the difference', 'the quotient'],
    answerIndex: 7,
    rationale: '',
    concept: 'x',
    conceptLabel: 'X',
  });
  assert.equal(parseQuestion(bad), undefined);
});

test('parseQuestion returns undefined for non-JSON or missing fields', () => {
  assert.equal(parseQuestion('no json here'), undefined);
  assert.equal(parseQuestion('{"question": "only question"}'), undefined);
  assert.equal(parseQuestion('[]'), undefined);
});
