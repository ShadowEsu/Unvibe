import test from 'node:test';
import assert from 'node:assert/strict';
import type { WidgetEvent } from '../src/main/review';
import { FOLLOW_UP_BLOCKED, freshState, heldFollowUp, reduceEvent, type PanelState } from '../src/renderer/widget/panelState';

const finding = { rule: 'high-entropy-string', severity: 'suspect' as const, file: 'question', line: 1, masked: 'Xq7f••••Qe' };
const ev = (e: unknown) => e as WidgetEvent;

/** An explanation on screen with one follow-up on its way. */
function asking(question: string): PanelState {
  return {
    ...freshState(),
    phase: 'done',
    text: 'The answer.',
    followUps: [{ id: 1, question, answer: '', phase: 'waiting' }],
  };
}

test('a follow-up held for a possible secret keeps its exact question; editing the Ask field never changes what Send anyway sends', () => {
  const held = reduceEvent(asking('Is Xq7fP2vL9mZr4Tb8Kw1Nc6Hy3Ds5Gj0Qe right?'), ev({ type: 'consent', findings: [finding] }));
  assert.equal(held.phase, 'consent');
  assert.deepEqual(held.followUps, []);
  assert.equal(held.refusedQuestion, 'Is Xq7fP2vL9mZr4Tb8Kw1Nc6Hy3Ds5Gj0Qe right?');
  // The field is edited while the sheet shows (or before Send anyway): consent still covers only the held text.
  const edited = { ...held, ask: 'something else entirely' };
  assert.equal(heldFollowUp(edited), 'Is Xq7fP2vL9mZr4Tb8Kw1Nc6Hy3Ds5Gj0Qe right?');
});

test('a follow-up held for the AI agreement keeps its question too', () => {
  const held = reduceEvent(asking('Why a closure?'), ev({ type: 'consentNeeded', provider: 'unvibe' }));
  assert.equal(held.phase, 'aiConsent');
  assert.equal(heldFollowUp(held), 'Why a closure?');
});

test('a sheet about the explanation itself holds no question, so Send anyway re-sends the explanation', () => {
  const s = reduceEvent({ ...freshState(), phase: 'ready', ask: 'typed but never sent' }, ev({ type: 'consent', findings: [finding] }));
  assert.equal(s.phase, 'consent');
  assert.equal(heldFollowUp(s), null);
});

test('a credential in a follow-up stays in the Ask thread and the answer stays on Explain', () => {
  // Main found a credential in the question (its scan isn't part of this reducer, so the words don't matter here).
  const s = reduceEvent(asking('Why does my access key fail?'), ev({ type: 'blocked', findings: [{ ...finding, severity: 'block' }] }));
  assert.equal(s.phase, 'done');
  assert.equal(s.text, 'The answer.');
  assert.equal(s.refusedQuestion, '');
  assert.deepEqual(s.followUps.map((f) => [f.phase, f.error]), [['error', FOLLOW_UP_BLOCKED]]);
});

test('a new selection drops a held question', () => {
  const held = reduceEvent(asking('Why a closure?'), ev({ type: 'consent', findings: [finding] }));
  const next = reduceEvent(held, ev({ type: 'init', hasCode: true, providerName: 'Unvibe', level: 'beginner' }));
  assert.equal(heldFollowUp(next), null);
});
