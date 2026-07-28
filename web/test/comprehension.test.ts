import { describe, it } from 'node:test';
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

describe('parseQuestion', () => {
  it('parses valid JSON input', () => {
    const q = parseQuestion(JSON.stringify(validJson));
    assert.notEqual(q, undefined);
    assert.equal(q!.question, validJson.question);
    assert.equal(q!.options.length, 4);
    assert.equal(q!.answerIndex, 0);
    assert.equal(q!.rationale, validJson.rationale);
    assert.equal(q!.concept, 'array-reduce');
    assert.equal(q!.conceptLabel, 'Array reduce');
  });

  it('returns undefined for empty string', () => {
    assert.equal(parseQuestion(''), undefined);
  });

  it('returns undefined for non-JSON text', () => {
    assert.equal(parseQuestion('not json at all'), undefined);
  });

  it('returns undefined for missing question field', () => {
    const { question: _, ...rest } = validJson;
    assert.equal(parseQuestion(JSON.stringify(rest)), undefined);
  });

  it('returns undefined for empty question string', () => {
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, question: '' })), undefined);
  });

  it('returns undefined for question that is only whitespace', () => {
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, question: '   ' })), undefined);
  });

  it('returns undefined for fewer than 2 options', () => {
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, options: ['only one'] })), undefined);
  });

  it('returns undefined for empty option strings', () => {
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, options: ['valid', ''] })), undefined);
  });

  it('returns undefined for option that is only whitespace', () => {
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, options: ['valid', '   '] })), undefined);
  });

  it('returns undefined for answerIndex out of bounds', () => {
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, answerIndex: 99 })), undefined);
  });

  it('returns undefined for negative answerIndex', () => {
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, answerIndex: -1 })), undefined);
  });

  it('returns undefined for missing rationale', () => {
    const { rationale: _, ...rest } = validJson;
    assert.equal(parseQuestion(JSON.stringify(rest)), undefined);
  });

  it('returns undefined for empty rationale', () => {
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, rationale: '' })), undefined);
  });

  it('tolerates JSON inside code fences', () => {
    const fenced = '```json\n' + JSON.stringify(validJson) + '\n```';
    const q = parseQuestion(fenced);
    assert.notEqual(q, undefined);
    assert.equal(q!.question, validJson.question);
  });

  it('tolerates leading prose before JSON', () => {
    const withProse = 'Here is the question: ' + JSON.stringify(validJson);
    const q = parseQuestion(withProse);
    assert.notEqual(q, undefined);
    assert.equal(q!.question, validJson.question);
  });

  it('trims whitespace from question, options, and rationale', () => {
    const spaced = {
      ...validJson,
      question: '  What does reduce do?  ',
      options: ['  First option  ', '  Second option  '],
      rationale: '  Some rationale  ',
    };
    const q = parseQuestion(JSON.stringify(spaced));
    assert.notEqual(q, undefined);
    assert.equal(q!.question, 'What does reduce do?');
    assert.equal(q!.options[0], 'First option');
    assert.equal(q!.options[1], 'Second option');
    assert.equal(q!.rationale, 'Some rationale');
  });

  it('defaults concept to "general" and conceptLabel to "General" when missing', () => {
    const { concept: _, conceptLabel: __, ...rest } = validJson;
    const q = parseQuestion(JSON.stringify(rest));
    assert.notEqual(q, undefined);
    assert.equal(q!.concept, 'general');
    assert.equal(q!.conceptLabel, 'General');
  });

  it('defaults concept to "general" when empty', () => {
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, concept: '' }))?.concept, 'general');
    assert.equal(parseQuestion(JSON.stringify({ ...validJson, concept: '   ' }))?.concept, 'general');
  });
});
