import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, safeStorage } from './electronStub';

// A computer west of UTC, so its local midnight is not the UTC one (node:test runs each file in its own process).
process.env.TZ = 'America/Los_Angeles';
// The store and its erase live under userData; this file gets its own.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-today-goal-'));
app.getPath = (): string => userData;
safeStorage.isEncryptionAvailable = (): boolean => true;

import { computeToday, forSync, localDayKey, withAnswerDay, type LocalEvent } from '../src/core/learning';
import { deleteAccountAndLocalData } from '../src/main/accountDeletion';
import { store } from '../src/main/store';
import { mergeRemoteEvents } from '../src/core/syncModel';
import { answerQuizCard, startQuizCard } from '../src/main/studyQuiz';

/** Local wall-clock time on the test computer (month is 1-based). */
function local(year: number, month: number, day: number, hour = 12, minute = 0, second = 0, ms = 0): Date {
  return new Date(year, month - 1, day, hour, minute, second, ms);
}

let next = 0;
/** A lesson explained at `at`, recorded the way the panel records it, answered at each of `answeredAt`. */
function lesson(at: Date, answeredAt: Date[] = []): LocalEvent {
  next += 1;
  let answeredOn: string[] | undefined;
  for (const when of answeredAt) answeredOn = withAnswerDay(answeredOn, when);
  return {
    id: `lesson-${next}`,
    ts: at.toISOString(),
    eventType: 'explanation_completed',
    localDate: localDayKey(at),
    timezone: 'America/Los_Angeles',
    scope: 'selection',
    level: 'beginner',
    outcome: 'reviewed',
    lines: 3,
    code: 'const doubled = values.map((v) => v * 2);',
    ...(answeredOn ? { answeredOn } : {}),
  };
}

/** Explained and answered on the same local day. */
function goalMet(at: Date): LocalEvent {
  return lesson(at, [at]);
}

test('the day ends at the computer\'s local midnight, not at UTC midnight', () => {
  // 23:59:59.999 on Oct 26 in Los Angeles is already Oct 27 in UTC.
  const lastMoment = local(2026, 10, 26, 23, 59, 59, 999);
  const events = [goalMet(lastMoment)];
  assert.deepEqual(computeToday(events, lastMoment), { explained: true, answered: true }, 'still Oct 26 one millisecond before midnight');
  const midnight = local(2026, 10, 27, 0, 0, 0, 0);
  assert.deepEqual(computeToday(events, midnight), { explained: false, answered: false }, 'at midnight Oct 27 starts empty');
  // The other side of midnight: an answer at 00:00 counts for the new day only.
  const early = lesson(local(2026, 10, 26, 9), [midnight]);
  assert.deepEqual(early.answeredOn, ['2026-10-27'], 'an answer at local midnight belongs to the new day');
});

test('an explanation and an answer are each counted on their own day', () => {
  const explainedOnly = lesson(local(2026, 10, 24, 10)); // never answered
  const answeredLater = lesson(local(2026, 10, 23, 10), [local(2026, 10, 25, 10)]); // Oct 23 explained only, Oct 25 answered only
  const events = [explainedOnly, answeredLater];
  assert.deepEqual(computeToday(events, local(2026, 10, 25, 20)), { explained: false, answered: true }, 'Oct 25: answered only');
  assert.deepEqual(computeToday([lesson(local(2026, 10, 26, 9))], local(2026, 10, 26, 20)), { explained: true, answered: false }, 'explained today, not answered');
  assert.deepEqual(computeToday([lesson(local(2026, 10, 20, 9), [local(2026, 10, 26, 9)])], local(2026, 10, 26, 20)), { explained: false, answered: true }, 'answered today, nothing explained today');
});

test('answer days stay on this computer: never in what sync uploads, kept when the cloud copy comes back', () => {
  const event = goalMet(local(2026, 10, 26, 9));
  assert.equal('answeredOn' in forSync(event), false, 'not uploaded');
  const merged = mergeRemoteEvents([event], [], [forSync(event)]).events;
  assert.deepEqual(merged[0]?.answeredOn, ['2026-10-26'], 'the cloud copy without them does not erase them');
});

test('a quiz card answer, right or wrong, counts as today\'s answer', { timeout: 10_000 }, async () => {
  const original = globalThis.fetch;
  // No question service: the card falls back to its on-device question (answer 0).
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  try {
    store().wipeEverything();
    const now = new Date();
    const event = lesson(now);
    store().recordReview(event);
    assert.equal(computeToday(store().events(), now).answered, false);
    const started = await startQuizCard(event.id);
    assert.equal(started.ok, true);
    const result = answerQuizCard(event.id, 1);
    assert.deepEqual(result.ok && result.correct, false, 'a wrong pick');
    assert.deepEqual(computeToday(store().events(), new Date()), { explained: true, answered: true }, 'the wrong pick still answered today');
  } finally {
    globalThis.fetch = original;
  }
});

test('Erase everything and account deletion leave nothing today', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith('/api/v1/account') && init?.method === 'DELETE') return Response.json({ ok: true, status: 'deleted' });
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  const seed = (): void => {
    store().wipeEverything();
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    store().recordReview(goalMet(yesterday));
    const todays = lesson(now);
    store().recordReview(todays);
    store().setOutcome(todays.id, 'understood', 'map', 'Array map', now);
    assert.deepEqual(computeToday(store().events(), new Date()), { explained: true, answered: true }, 'seeded: met yesterday and today');
  };
  try {
    seed();
    const erased = await deleteAccountAndLocalData(() => undefined);
    assert.deepEqual(erased, { ok: true, status: 'erased_locally' });
    assert.deepEqual(computeToday(store().events(), new Date()), { explained: false, answered: false }, 'after Erase everything');

    seed();
    store().setAccount('user-1', 'person@example.com', 'session-token');
    const deleted = await deleteAccountAndLocalData(() => undefined);
    assert.deepEqual(deleted, { ok: true, status: 'deleted' });
    assert.deepEqual(computeToday(store().events(), new Date()), { explained: false, answered: false }, 'after account deletion');
  } finally {
    globalThis.fetch = original;
  }
});
