import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProfile, computeFeed, computeLearningItems, computeReviewQueue, bestStreak, currentStreak, deriveSkillState, forSync, heatLevel, localDayKey, type LocalEvent } from '../src/core/learning';

function ev(p: Partial<LocalEvent>): LocalEvent {
  return { id: Math.random().toString(36), ts: '2026-07-11T10:00:00Z', scope: 'selection', level: 'intermediate', outcome: 'reviewed', lines: 10, ...p };
}

test('currentStreak counts consecutive days ending today/yesterday', () => {
  const days = new Set(['2026-07-11', '2026-07-10', '2026-07-09', '2026-07-07']);
  assert.equal(currentStreak(days, '2026-07-11'), 3);
  assert.equal(currentStreak(new Set(['2026-07-05']), '2026-07-11'), 0);
});

test('bestStreak finds the longest run', () => {
  assert.equal(bestStreak(new Set(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-08', '2026-07-09'])), 3);
  assert.equal(bestStreak(new Set()), 0);
});

test('computeProfile sums lines and uses cautious concept evidence', () => {
  const events = [
    ev({ ts: '2026-07-11T09:00:00Z', lines: 12, outcome: 'reviewed', sourceApp: 'Code' }),
    ev({ ts: '2026-07-11T09:05:00Z', lines: 8, outcome: 'understood', concept: 'closures', conceptLabel: 'Closures', sourceApp: 'iTerm' }),
  ];
  const p = computeProfile(events, '2026-07-11');
  assert.equal(p.reviews, 2);
  assert.equal(p.linesReviewed, 20);
  assert.equal(p.linesUnderstood, 8);
  assert.equal(p.conceptsDeveloping, 1);
  assert.equal(p.conceptsFamiliar, 0);
  assert.equal(p.streak, 1);
  assert.equal(p.heat.length, 182);
  assert.equal(p.heat[181], 1); // 20 lines today -> shade 1 (5+)
  // usage buckets both apps
  assert.equal(p.usage.find((u) => u.label === 'Editors & IDEs')?.pct, 50);
  assert.equal(p.usage.find((u) => u.label === 'Terminal')?.pct, 50);
});

test('streak uses the captured local date rather than the UTC date', () => {
  const events = [ev({ ts: '2026-07-12T06:30:00Z', localDate: '2026-07-11', timezone: 'America/Los_Angeles' })];
  assert.equal(computeProfile(events, '2026-07-11').streak, 1);
  assert.equal(computeProfile(events, '2026-07-12').streak, 1);
});

test('heatLevel maps explained lines to five shades', () => {
  assert.equal(heatLevel(0), 0);
  assert.equal(heatLevel(4), 0);
  assert.equal(heatLevel(5), 1);
  assert.equal(heatLevel(24), 1);
  assert.equal(heatLevel(25), 2);
  assert.equal(heatLevel(50), 3);
  assert.equal(heatLevel(100), 4);
  assert.equal(heatLevel(200), 5);
});

test('days with only app opens, Ask chats or the first-run sample are not streak days', () => {
  const events = ['2026-07-09', '2026-07-10', '2026-07-11'].flatMap((day) => [
    ev({ id: `active-${day}`, eventType: 'day_active', scope: 'app', lines: 0, localDate: day }),
    ev({ scope: 'chat', eventType: 'explanation_completed', localDate: day, concept: 'chat' }),
    ev({ eventType: 'explanation_completed', localDate: day, sample: true }),
  ]);
  const p = computeProfile(events, '2026-07-11');
  assert.equal(p.streak, 0);
  assert.equal(p.bestStreak, 0);
});

test('one explanation of own code makes today a streak day', () => {
  const p = computeProfile([ev({ eventType: 'explanation_completed', localDate: '2026-07-11' })], '2026-07-11');
  assert.equal(p.streak, 1);
  assert.equal(p.bestStreak, 1);
});

test('an explanation marked understood counts as a streak day', () => {
  const p = computeProfile([ev({ eventType: 'explanation_completed', localDate: '2026-07-11', outcome: 'understood' })], '2026-07-11');
  assert.equal(p.streak, 1);
});

test('two learning days in a row make a streak of two, with an open-only day before them', () => {
  const events = [
    ev({ id: 'active-2026-07-09', eventType: 'day_active', scope: 'app', lines: 0, localDate: '2026-07-09' }),
    ev({ eventType: 'explanation_completed', localDate: '2026-07-10' }),
    ev({ eventType: 'explanation_completed', localDate: '2026-07-11' }),
  ];
  assert.equal(computeProfile(events, '2026-07-11').streak, 2);
});

test('a day without learning breaks the streak even if the app was opened', () => {
  const events = [
    ev({ eventType: 'explanation_completed', localDate: '2026-07-08' }),
    ev({ eventType: 'explanation_completed', localDate: '2026-07-09' }),
    ev({ id: 'active-2026-07-10', eventType: 'day_active', scope: 'app', lines: 0, localDate: '2026-07-10' }),
    ev({ eventType: 'explanation_completed', localDate: '2026-07-11' }),
  ];
  const p = computeProfile(events, '2026-07-11');
  assert.equal(p.streak, 1);
  assert.equal(p.bestStreak, 2);
  // Yesterday's learning still holds the streak until today ends; two empty days end it.
  assert.equal(computeProfile(events, '2026-07-12').streak, 1);
  assert.equal(computeProfile(events, '2026-07-13').streak, 0);
});

test('the streak day turns over at local midnight, not UTC midnight', () => {
  // Los Angeles: 23:59 on the 10th and 00:01 on the 11th are both on the 11th in UTC.
  const beforeMidnight = new Date(2026, 6, 10, 23, 59, 59);
  const afterMidnight = new Date(2026, 6, 11, 0, 0, 1);
  assert.equal(localDayKey(beforeMidnight), '2026-07-10');
  assert.equal(localDayKey(afterMidnight), '2026-07-11');
  const events = [
    ev({ eventType: 'explanation_completed', ts: '2026-07-11T06:59:00Z', localDate: '2026-07-10', timezone: 'America/Los_Angeles' }),
    ev({ eventType: 'explanation_completed', ts: '2026-07-11T07:01:00Z', localDate: '2026-07-11', timezone: 'America/Los_Angeles' }),
  ];
  assert.equal(computeProfile(events, '2026-07-11').streak, 2);
});

test('chat lines add heat without appearing in history', () => {
  const events = [ev({
    id: 'chat-1',
    scope: 'chat',
    eventType: 'explanation_completed',
    lines: 60,
    localDate: '2026-07-11',
    concept: 'chat',
  })];
  const p = computeProfile(events, '2026-07-11');
  assert.equal(p.streak, 0);
  assert.equal(p.heat[181], 3);
  assert.equal(p.reviews, 0);
  assert.equal(computeLearningItems(events, 10).length, 0);
});

test('skill evidence never labels a single correct answer strong', () => {
  assert.equal(deriveSkillState([ev({ outcome: 'understood' })]), 'Developing');
  assert.equal(deriveSkillState([
    ev({ id: 'one', ts: '2026-07-09T10:00:00Z', outcome: 'understood' }),
    ev({ id: 'two', ts: '2026-07-10T10:00:00Z', outcome: 'understood' }),
  ]), 'Familiar');
  assert.equal(deriveSkillState([
    ev({ id: 'one', ts: '2026-07-09T10:00:00Z', outcome: 'understood' }),
    ev({ id: 'two', ts: '2026-07-10T10:00:00Z', outcome: 'needs_review' }),
  ]), 'Needs review');
});

test('computeFeed returns most-recent first', () => {
  const events = [ev({ id: 'a', ts: '2026-07-11T08:00:00Z' }), ev({ id: 'b', ts: '2026-07-11T09:00:00Z' })];
  const feed = computeFeed(events, 5);
  assert.equal(feed[0].id, 'b');
  assert.equal(feed.length, 2);
});

test('computeLearningItems includes on-device code and explanation when present', () => {
  const items = computeLearningItems([
    ev({ id: 'earlier', ts: '2026-07-11T08:00:00Z', lines: 6, language: 'TypeScript' }),
    ev({
      id: 'latest',
      ts: '2026-07-11T09:00:00Z',
      concept: 'closures',
      conceptLabel: 'Closures',
      level: 'advanced',
      lines: 12,
      outcome: 'needs_review',
      code: 'const f = () => x;',
      explanation: 'This closes over x.',
      note: 'Remember that x comes from the outer scope.',
    }),
  ], 10);
  assert.equal(items[0]!.id, 'latest');
  assert.equal(items[0]!.title, 'Closures');
  assert.equal(items[0]!.outcome, 'needs_review');
  assert.equal(items[0]!.concept, 'Closures');
  assert.equal(items[0]!.level, 'advanced');
  assert.equal(items[0]!.lines, 12);
  assert.equal(items[0]!.code, 'const f = () => x;');
  assert.equal(items[0]!.explanation, 'This closes over x.');
  assert.equal(items[0]!.note, 'Remember that x comes from the outer scope.');
  assert.equal(items[1]!.code, undefined);
});

test('personal lesson notes never enter the cloud sync payload', () => {
  const local = ev({ code: 'const x = 1;', explanation: 'Sets x.', note: 'Ask why this is const.' });
  const payload = forSync(local);
  assert.equal(payload.code, undefined);
  assert.equal(payload.explanation, undefined);
  assert.equal(payload.note, undefined);
});

test('computeReviewQueue prioritizes needs_review then spaced understood items', () => {
  const now = new Date('2026-07-20T12:00:00Z');
  const queue = computeReviewQueue([
    // Same calendar day as now: not yet due for 1d revisit.
    ev({ id: 'fresh', ts: '2026-07-20T08:00:00Z', outcome: 'understood', conceptLabel: 'Fresh' }),
    ev({ id: 'old', ts: '2026-07-10T12:00:00Z', outcome: 'understood', conceptLabel: 'Old' }),
    ev({ id: 'revisit', ts: '2026-07-18T12:00:00Z', outcome: 'needs_review', conceptLabel: 'Revisit' }),
  ], now, 10);
  assert.equal(queue[0]!.title, 'Revisit');
  assert.equal(queue[0]!.dueLabel, 'Needs review');
  const old = queue.find((item) => item.title === 'Old');
  assert.ok(old);
  assert.equal(old!.dueLabel, '7d revisit');
  assert.ok(!queue.some((item) => item.title === 'Fresh'));
});
