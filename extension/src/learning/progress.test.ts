import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, addEvent, setOutcome, computeStreak, summarize } from './progress';
import type { LearningEvent } from './types';

function ev(id: string, ts: string, outcome: LearningEvent['outcome'] = 'reviewed'): LearningEvent {
  return { id, ts, scope: 'file', level: 'intermediate', outcome };
}

test('addEvent appends and summarize counts one review per event', () => {
  let s = emptyState();
  s = addEvent(s, ev('1', '2026-07-11T10:00:00Z'));
  s = addEvent(s, ev('2', '2026-07-11T11:00:00Z'));
  const p = summarize(s, '2026-07-11');
  assert.equal(p.totalReviews, 2);
  assert.equal(p.understood, 0);
});

test('setOutcome upgrades outcome and concept mastery', () => {
  let s = emptyState();
  s = addEvent(s, ev('1', '2026-07-11T10:00:00Z'));
  s = setOutcome(s, '1', 'understood', 'async-await', 'Async/await');
  assert.equal(s.events[0].outcome, 'understood');
  assert.equal(s.concepts['async-await'].state, 'understood');
  const p = summarize(s, '2026-07-11');
  assert.equal(p.understood, 1);
  assert.equal(p.conceptsUnderstood, 1);
});

test('needs_review sets concept to needs_review', () => {
  let s = emptyState();
  s = addEvent(s, ev('1', '2026-07-11T10:00:00Z'));
  s = setOutcome(s, '1', 'needs_review', 'closures', 'Closures');
  assert.equal(s.concepts['closures'].state, 'needs_review');
  assert.equal(summarize(s, '2026-07-11').conceptsNeedReview, 1);
});

test('computeStreak counts consecutive days ending today', () => {
  const events = [
    ev('1', '2026-07-09T10:00:00Z'),
    ev('2', '2026-07-10T10:00:00Z'),
    ev('3', '2026-07-11T10:00:00Z'),
  ];
  assert.equal(computeStreak(events, '2026-07-11'), 3);
});

test('computeStreak still counts when last active was yesterday', () => {
  const events = [ev('1', '2026-07-10T10:00:00Z')];
  assert.equal(computeStreak(events, '2026-07-11'), 1);
});

test('computeStreak breaks on a gap', () => {
  const events = [ev('1', '2026-07-07T10:00:00Z'), ev('3', '2026-07-11T10:00:00Z')];
  assert.equal(computeStreak(events, '2026-07-11'), 1);
});

test('computeStreak is 0 when inactive two+ days', () => {
  const events = [ev('1', '2026-07-01T10:00:00Z')];
  assert.equal(computeStreak(events, '2026-07-11'), 0);
});
