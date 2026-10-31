import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from './electronStub';

// The store lives under userData; give this file its own so nothing else is touched.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-pmf-eligibility-'));
app.getPath = (): string => userData;

import type { LocalEvent } from '../src/core/learning';
import {
  completedExplanations,
  earliestFirstRun,
  pmfEligible,
  type PmfEligibilityInput,
} from '../src/core/pmf';
import { store } from '../src/main/store';

const DAY = 86_400_000;
const NOW = new Date('2026-11-10T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
const base: PmfEligibilityInput = { explanations: 3, firstRunAt: daysAgo(3), status: undefined, shownThisRun: false, now: NOW };

function lesson(id: string, ts: string, extra: Partial<LocalEvent> = {}): LocalEvent {
  return { id, ts, eventType: 'explanation_completed', scope: 'selection', level: 'beginner', outcome: 'reviewed', lines: 3, ...extra };
}

test('3 completed explanations is eligible, 2 is not', () => {
  assert.equal(pmfEligible(base), true);
  assert.equal(pmfEligible({ ...base, explanations: 2 }), false);
  assert.equal(pmfEligible({ ...base, explanations: 0 }), false);
  assert.equal(pmfEligible({ ...base, explanations: 40 }), true);
});

test('3 full days since the first run is eligible, 2.9 days is not', () => {
  assert.equal(pmfEligible({ ...base, firstRunAt: daysAgo(3) }), true);
  assert.equal(pmfEligible({ ...base, firstRunAt: daysAgo(2.9) }), false);
  assert.equal(pmfEligible({ ...base, firstRunAt: new Date(NOW.getTime() - 3 * DAY + 1).toISOString() }), false, 'one millisecond short');
  assert.equal(pmfEligible({ ...base, firstRunAt: daysAgo(30) }), true);
});

test('dismissed or sent is never eligible again, even in the run that showed it', () => {
  assert.equal(pmfEligible({ ...base, status: 'dismissed' }), false);
  assert.equal(pmfEligible({ ...base, status: 'sent' }), false);
  assert.equal(pmfEligible({ ...base, status: 'sent', explanations: 500, firstRunAt: daysAgo(400) }), false);
  assert.equal(pmfEligible({ ...base, status: 'dismissed', shownThisRun: true }), false);
  assert.equal(pmfEligible({ ...base, status: 'sent', shownThisRun: true }), false);
});

test('shown: eligible only in the same run (memory flag set), never after a restart', () => {
  assert.equal(pmfEligible({ ...base, status: 'shown', shownThisRun: true }), true);
  assert.equal(pmfEligible({ ...base, status: 'shown', shownThisRun: false }), false);
  assert.equal(pmfEligible({ ...base, status: 'shown', shownThisRun: true, explanations: 2 }), false);
});

test('a missing or unreadable first-run timestamp is not eligible', () => {
  assert.equal(pmfEligible({ ...base, firstRunAt: undefined }), false);
  assert.equal(pmfEligible({ ...base, firstRunAt: '' }), false);
  assert.equal(pmfEligible({ ...base, firstRunAt: 'not a date' }), false);
});

test('only explanations the person asked for count: not the first-run sample or day markers', () => {
  const events = [
    lesson('a', daysAgo(5)),
    lesson('sample', daysAgo(5), { sample: true }),
    lesson('day', daysAgo(4), { eventType: 'day_active' }),
    lesson('legacy', daysAgo(4), { eventType: undefined }),
    lesson('b', daysAgo(1)),
  ];
  assert.equal(completedExplanations(events), 3);
  assert.equal(completedExplanations(events.slice(0, 3)), 1);
});

test('the inferred first run is the earliest evidence, never later, and now when there is none', () => {
  assert.equal(earliestFirstRun([], NOW), NOW.toISOString());
  assert.equal(earliestFirstRun([undefined, 'garbage'], NOW), NOW.toISOString());
  assert.equal(earliestFirstRun([daysAgo(2), daysAgo(9), undefined], NOW), daysAgo(9));
  assert.equal(earliestFirstRun([new Date(NOW.getTime() + DAY).toISOString()], NOW), NOW.toISOString(), 'a future time is never used');
});

test('store: the first run is persisted once, from the oldest record when missing, and kept after a wipe', () => {
  const s = store();
  s.recordReview(lesson('old', daysAgo(6)));
  s.recordReview(lesson('new', daysAgo(1)));
  const first = s.firstRunAt(NOW);
  assert.equal(first, daysAgo(6), 'an install updating into this version keeps its true age');
  const saved = JSON.parse(readFileSync(path.join(userData, 'unvibe-store.json'), 'utf8')) as { firstRunAt?: string };
  assert.equal(saved.firstRunAt, first);
  assert.equal(s.firstRunAt(new Date(NOW.getTime() + 10 * DAY)), first, 'never moves later');
  s.wipeEverything();
  assert.equal(s.firstRunAt(NOW), first);
});

test('store: the draft stays until the survey is sent or closed, and a closed survey survives a wipe', () => {
  const s = store();
  assert.equal(s.pmfStatus(), undefined);
  s.savePmfDraft({ q1: 'somewhat', q2: 'Students', q3: '', q4: 'Faster' });
  assert.deepEqual(s.pmfDraft(), { q1: 'somewhat', q2: 'Students', q3: '', q4: 'Faster' });
  s.setPmfStatus('shown');
  assert.deepEqual(s.pmfDraft(), { q1: 'somewhat', q2: 'Students', q3: '', q4: 'Faster' }, 'shown keeps the draft for this run');
  s.savePmfDraft({ q1: 'very', q2: 'Students', q3: '', q4: 'Faster' });
  assert.equal(s.pmfStatus(), 'shown');
  assert.equal(s.pmfDraft().q1, 'very', 'typing while shown still saves');
  s.setPmfStatus('dismissed');
  assert.equal(s.pmfStatus(), 'dismissed');
  assert.deepEqual(s.pmfDraft(), { q1: '', q2: '', q3: '', q4: '' }, 'closing deletes the draft');
  s.savePmfDraft({ q1: 'very', q2: '', q3: '', q4: '' });
  assert.deepEqual(s.pmfDraft(), { q1: '', q2: '', q3: '', q4: '' }, 'a closed survey keeps no new draft');
  s.wipeEverything();
  assert.equal(s.pmfStatus(), 'dismissed');
});
