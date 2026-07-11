import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enqueue, removeIds } from './outbox';
import type { LearningEvent } from '../learning/types';

function ev(id: string, outcome: LearningEvent['outcome'] = 'reviewed'): LearningEvent {
  return { id, ts: '2026-07-11T10:00:00Z', scope: 'file', level: 'intermediate', outcome };
}

test('enqueue appends new events', () => {
  const out = enqueue([ev('1')], [ev('2')]);
  assert.equal(out.length, 2);
});

test('enqueue replaces an event with the same id (outcome upgrade)', () => {
  const out = enqueue([ev('1', 'reviewed')], [ev('1', 'understood')]);
  assert.equal(out.length, 1);
  assert.equal(out[0].outcome, 'understood');
});

test('removeIds drops synced events', () => {
  const out = removeIds([ev('1'), ev('2'), ev('3')], ['1', '3']);
  assert.deepEqual(out.map((e) => e.id), ['2']);
});

test('removeIds on empty ids is a no-op', () => {
  assert.equal(removeIds([ev('1')], []).length, 1);
});
