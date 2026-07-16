import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProfile, computeStreak, dateInTimezone } from '../src/data/progress';
import type { IncomingEvent } from '../src/data/types';

function event(id: string, patch: Partial<IncomingEvent> = {}): IncomingEvent {
  return {
    id,
    ts: '2026-07-12T06:30:00Z',
    localDate: '2026-07-11',
    timezone: 'America/Los_Angeles',
    scope: 'selection',
    level: 'intermediate',
    outcome: 'reviewed',
    ...patch,
  };
}

test('server streak uses the immutable user-local activity date', () => {
  assert.equal(computeStreak([event('one')], '2026-07-11'), 1);
});

test('current date is evaluated in the learner timezone across UTC midnight', () => {
  assert.equal(dateInTimezone(new Date('2026-07-12T06:30:00Z'), 'America/Los_Angeles'), '2026-07-11');
});

test('profile requires repeated evidence for familiar and strong concepts', () => {
  const events = [
    event('one', { concept: 'closures', outcome: 'understood' }),
    event('two', { concept: 'promises', outcome: 'understood' }),
    event('three', { concept: 'promises', outcome: 'understood' }),
  ];
  const profile = computeProfile(events);
  assert.equal(profile.conceptsUnderstood, 2);
  assert.equal(profile.conceptsFamiliar, 1);
  assert.equal(profile.conceptsStrong, 0);
});

test('latest confusion keeps a concept in needs review', () => {
  const profile = computeProfile([
    event('one', { ts: '2026-07-10T10:00:00Z', concept: 'closures', outcome: 'understood' }),
    event('two', { ts: '2026-07-11T10:00:00Z', concept: 'closures', outcome: 'needs_review' }),
  ]);
  assert.equal(profile.conceptsNeedReview, 1);
  assert.equal(profile.conceptsFamiliar, 0);
});
