import test from 'node:test';
import assert from 'node:assert/strict';
import { isIncomingEvent } from '../src/data/eventValidation';

const valid = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  ts: '2026-07-15T20:00:00.000Z',
  localDate: '2026-07-15',
  scope: 'selection',
  level: 'intermediate',
  outcome: 'reviewed',
  lines: 12,
};

test('accepts a bounded client-generated activity event', () => {
  assert.equal(isIncomingEvent(valid), true);
});

test('rejects invalid ids, outcomes, dates, and line counts', () => {
  assert.equal(isIncomingEvent({ ...valid, id: 'shared-id' }), false);
  assert.equal(isIncomingEvent({ ...valid, outcome: 'mastered' }), false);
  assert.equal(isIncomingEvent({ ...valid, ts: 'not-a-date' }), false);
  assert.equal(isIncomingEvent({ ...valid, lines: -1 }), false);
});
