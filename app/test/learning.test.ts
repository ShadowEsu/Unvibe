import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProfile, computeFeed, computeLearningItems, computeReviewQueue, bestStreak, currentStreak, deriveSkillState, daysSince, decaySkillState, type LocalEvent } from '../src/core/learning';

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
  assert.equal(p.heat[181], 2); // 2 events today -> intensity 2
  // usage buckets both apps
  assert.equal(p.usage.find((u) => u.label === 'Editors & IDEs')?.pct, 50);
  assert.equal(p.usage.find((u) => u.label === 'Terminal')?.pct, 50);
});

test('streak uses the captured local date rather than the UTC date', () => {
  const events = [ev({ ts: '2026-07-12T06:30:00Z', localDate: '2026-07-11', timezone: 'America/Los_Angeles' })];
  assert.equal(computeProfile(events, '2026-07-11').streak, 1);
  assert.equal(computeProfile(events, '2026-07-12').streak, 1);
});

test('skill evidence never labels a single correct answer strong', () => {
  const now = new Date('2026-07-20T12:00:00Z');
  assert.equal(deriveSkillState([ev({ outcome: 'understood' })], now), 'Developing');
  assert.equal(deriveSkillState([
    ev({ id: 'one', ts: '2026-07-09T10:00:00Z', outcome: 'understood' }),
    ev({ id: 'two', ts: '2026-07-10T10:00:00Z', outcome: 'understood' }),
  ], now), 'Familiar');
  assert.equal(deriveSkillState([
    ev({ id: 'one', ts: '2026-07-09T10:00:00Z', outcome: 'understood' }),
    ev({ id: 'two', ts: '2026-07-10T10:00:00Z', outcome: 'needs_review' }),
  ], now), 'Needs review');
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
  assert.equal(items[1]!.code, undefined);
});

test('daysSince returns days between two dates', () => {
  const now = new Date('2026-07-20T12:00:00Z');
  assert.equal(daysSince('2026-07-20T10:00:00Z', now), 0);
  assert.equal(daysSince('2026-07-19T10:00:00Z', now), 1);
  assert.equal(daysSince('2026-07-10T10:00:00Z', now), 10);
  assert.equal(daysSince('2026-04-20T10:00:00Z', now), 91);
});

test('decaySkillState leaves recent evidence unchanged', () => {
  assert.equal(decaySkillState('Strong', 5), 'Strong');
  assert.equal(decaySkillState('Familiar', 5), 'Familiar');
  assert.equal(decaySkillState('Developing', 5), 'Developing');
  assert.equal(decaySkillState('New', 5), 'New');
});

test('decaySkillState decays at 31-90 day window', () => {
  assert.equal(decaySkillState('Strong', 45), 'Familiar');
  assert.equal(decaySkillState('Familiar', 45), 'Developing');
  assert.equal(decaySkillState('Developing', 45), 'Developing');
  assert.equal(decaySkillState('New', 45), 'New');
});

test('decaySkillState decays further past 90 days', () => {
  assert.equal(decaySkillState('Strong', 180), 'Familiar');
  assert.equal(decaySkillState('Familiar', 180), 'Developing');
  assert.equal(decaySkillState('Developing', 180), 'New');
  assert.equal(decaySkillState('New', 180), 'New');
});

test('decaySkillState does not decay Needs review or Insufficient evidence', () => {
  assert.equal(decaySkillState('Needs review', 365), 'Needs review');
  assert.equal(decaySkillState('Insufficient evidence', 365), 'Insufficient evidence');
});

test('deriveSkillState decays Strong to Familiar after 31+ days without reinforcement', () => {
  const now = new Date('2026-08-20T12:00:00Z');
  assert.equal(deriveSkillState([
    ev({ id: 'one', ts: '2026-07-09T10:00:00Z', outcome: 'understood' }),
    ev({ id: 'two', ts: '2026-07-10T10:00:00Z', outcome: 'understood' }),
    ev({ id: 'three', ts: '2026-07-11T10:00:00Z', outcome: 'understood' }),
  ], now), 'Familiar');
});

test('deriveSkillState keeps Strong when evidence is recent (within 30 days)', () => {
  const now = new Date('2026-07-20T12:00:00Z');
  assert.equal(deriveSkillState([
    ev({ id: 'one', ts: '2026-07-09T10:00:00Z', outcome: 'understood' }),
    ev({ id: 'two', ts: '2026-07-10T10:00:00Z', outcome: 'understood' }),
    ev({ id: 'three', ts: '2026-07-19T10:00:00Z', outcome: 'understood' }),
  ], now), 'Strong');
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
