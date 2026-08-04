import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, buildUserPrompt, buildComprehensionPrompt } from '../src/ai/prompt';
import type { ReviewRequestPayload } from '../src/ai/protocol';

function payload(overrides: Partial<ReviewRequestPayload> = {}): ReviewRequestPayload {
  return {
    scope: 'selection',
    level: 'intermediate',
    context: {
      language: 'TypeScript',
      primaryFile: 'src/hooks/useTimer.ts',
      projectStructure: ['src'],
      imports: ['import { useState } from "react"'],
      code: 'export function useTimer() { return useState(0); }',
    },
    ...overrides,
  };
}

test('buildUserPrompt defaults to the scope-derived explanation task', () => {
  const user = buildUserPrompt(payload());
  assert.match(user, /## Task/);
  assert.match(user, /Explain what this code does and why/);
  assert.doesNotMatch(user, /## Follow-up question/);
});

test('buildUserPrompt uses the follow-up question when present', () => {
  const user = buildUserPrompt(payload({ question: 'Why the ref?', variant: 'different' }));
  assert.match(user, /## Follow-up question\nWhy the ref\?/);
  assert.doesNotMatch(user, /## Task/);
});

test('buildUserPrompt honours an explicit task override', () => {
  const user = buildUserPrompt(payload(), 'Do the override thing.');
  assert.match(user, /## Task\nDo the override thing\./);
  assert.doesNotMatch(user, /Explain what this code does and why/);
});

test('comprehension prompt asks for a question, not an explanation', () => {
  const { system, user } = buildComprehensionPrompt(payload());
  assert.match(system, /Generate ONE multiple-choice question/);
  assert.match(system, /"answerIndex": 0-3/);
  assert.match(user, /## Task/);
  assert.match(user, /Generate ONE multiple-choice comprehension question/);
  assert.doesNotMatch(user, /Explain what this code does and why/);
  assert.match(user, /src\/hooks\/useTimer\.ts/);
});

test('comprehension prompt keeps the quiz mode instruction', () => {
  const { system } = buildComprehensionPrompt(payload({ quizMode: 'recall' }));
  assert.match(system, /Mode: RECALL/);
  const scenario = buildComprehensionPrompt(payload({ quizMode: 'scenario' }));
  assert.match(scenario.system, /Mode: SCENARIO/);
});

test('system prompt always cites the audience level guidance', () => {
  const system = buildSystemPrompt(payload());
  assert.match(system, /Audience level — intermediate/);
  assert.match(system, /cite:FILE:LINE/);
});
