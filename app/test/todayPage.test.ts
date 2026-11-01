import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProfile, computeWeek, localDayKey, type LocalEvent } from '../src/core/learning';
import { todayFirstRun, weekSentence } from '../src/renderer/companion/today';

const NOW = new Date('2026-10-31T19:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
function ev(daysAgo: number, p: Partial<LocalEvent> = {}): LocalEvent {
  return { id: Math.random().toString(36), ts: new Date(NOW.getTime() - daysAgo * DAY).toISOString(), scope: 'selection', level: 'intermediate', outcome: 'reviewed', lines: 10, ...p };
}

test('the week reads as one sentence built from the weekly counts (Design C1)', () => {
  assert.equal(
    weekSentence({ explanations: 12, linesExplained: 52, linesUnderstood: 20 }),
    'This week: 12 explanations, 52 lines explained, 20 lines understood.',
  );
});

test('a count of one is singular in the week sentence', () => {
  assert.equal(weekSentence({ explanations: 1, linesExplained: 1, linesUnderstood: 1 }), 'This week: 1 explanation, 1 line explained, 1 line understood.');
});

test('a zero count gets no clause, except explanations', () => {
  assert.equal(weekSentence({ explanations: 3, linesExplained: 14, linesUnderstood: 0 }), 'This week: 3 explanations, 14 lines explained.');
  assert.equal(weekSentence({ explanations: 0, linesExplained: 4, linesUnderstood: 0 }), 'This week: no explanations yet, 4 lines explained.');
  assert.equal(weekSentence({ explanations: 0, linesExplained: 0, linesUnderstood: 0 }), 'This week: no explanations yet.');
});

test('the week counts the last 7 days, rolling: an event 6 days old counts, one 8 days old does not', () => {
  const events = [
    ev(6, { lines: 7, outcome: 'understood' }),
    ev(8, { lines: 30, outcome: 'understood' }),
  ];
  assert.deepEqual(computeWeek(events, NOW), { explanations: 1, linesExplained: 7, linesUnderstood: 7 });
  // Rolling, not calendar: 7 × 24 h before now is the edge.
  assert.equal(computeWeek([ev(7 - 1 / 24)], NOW).explanations, 1);
  assert.equal(computeWeek([ev(7 + 1 / 24)], NOW).explanations, 0);
});

test('the Explain banner and the Try voice card show only while nothing was ever explained (Design C1)', () => {
  assert.deepEqual(todayFirstRun({ reviews: 0 }), { explainBanner: true, voiceCard: true });
  assert.deepEqual(todayFirstRun({ reviews: 1 }), { explainBanner: false, voiceCard: false });
  assert.deepEqual(todayFirstRun({ reviews: 12 }), { explainBanner: false, voiceCard: false });
  // Still loading: nothing known, so no first-run card flashes on a filled profile.
  assert.deepEqual(todayFirstRun(null), { explainBanner: false, voiceCard: false });
});

test('a user whose only explanations are older than 7 days sees "no explanations yet" and no first-run banner', () => {
  const events = [ev(9), ev(12, { outcome: 'understood' }), ev(20)];
  assert.equal(weekSentence(computeWeek(events, NOW)), 'This week: no explanations yet.');
  assert.deepEqual(todayFirstRun(computeProfile(events, localDayKey(NOW))), { explainBanner: false, voiceCard: false });
});
