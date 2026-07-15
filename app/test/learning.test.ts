import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProfile, computeFeed, bestStreak, currentStreak, type LocalEvent } from '../src/core/learning';

function ev(p: Partial<LocalEvent>): LocalEvent {
  return { id: Math.random().toString(36), ts: '2026-07-11T10:00:00Z', scope: 'selection', level: 'intermediate', outcome: 'reviewed', lines: 10, ...p };
}

test('currentStreak counts consecutive days ending today/yesterday', () => {
  const days = new Set(['2026-07-11', '2026-07-10', '2026-07-09', '2026-07-07']);
  assert.equal(currentStreak(days, '2026-07-11'), 3);
  assert.equal(currentStreak(new Set(['2026-07-05']), '2026-07-11'), 0);
  assert.equal(currentStreak(new Set(['2026-07-11']), '2026-07-11'), 1);
  assert.equal(currentStreak(new Set(['2026-07-10']), '2026-07-11'), 1);
  assert.equal(currentStreak(new Set(['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12']), '2026-07-12'), 7);
  assert.equal(currentStreak(new Set(['2026-07-10', '2026-07-11']), '2026-07-12'), 2);
  assert.equal(currentStreak(new Set(), '2026-07-11'), 0);
});

test('bestStreak finds the longest run', () => {
  assert.equal(bestStreak(new Set(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-08', '2026-07-09'])), 3);
  assert.equal(bestStreak(new Set()), 0);
  assert.equal(bestStreak(new Set(['2026-07-01'])), 1);
  assert.equal(bestStreak(new Set(['2026-07-01', '2026-07-02'])), 2);
  assert.equal(bestStreak(new Set(['2026-07-01', '2026-07-02', '2026-07-05', '2026-07-06'])), 2);
  assert.equal(bestStreak(new Set(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'])), 5);
  assert.equal(bestStreak(new Set(['2026-07-05', '2026-07-06', '2026-07-07', '2026-07-10', '2026-07-11', '2026-07-12'])), 3);
});

test('computeProfile sums lines and masters concepts by latest outcome', () => {
  const events = [
    ev({ ts: '2026-07-11T09:00:00Z', lines: 12, outcome: 'reviewed', sourceApp: 'Code' }),
    ev({ ts: '2026-07-11T09:05:00Z', lines: 8, outcome: 'understood', concept: 'closures', conceptLabel: 'Closures', sourceApp: 'iTerm' }),
  ];
  const p = computeProfile(events, '2026-07-11');
  assert.equal(p.reviews, 2);
  assert.equal(p.linesReviewed, 20);
  assert.equal(p.linesUnderstood, 8);
  assert.equal(p.conceptsMastered, 1);
  assert.equal(p.streak, 1);
  assert.equal(p.heat.length, 182);
  assert.equal(p.heat[181], 2); // 2 events today -> intensity 2
  // usage buckets both apps
  assert.equal(p.usage.find((u) => u.label === 'Editors & IDEs')?.pct, 50);
  assert.equal(p.usage.find((u) => u.label === 'Terminal')?.pct, 50);
});

test('computeProfile handles empty events', () => {
  const p = computeProfile([], '2026-07-11');
  assert.equal(p.reviews, 0);
  assert.equal(p.understood, 0);
  assert.equal(p.needsReview, 0);
  assert.equal(p.linesReviewed, 0);
  assert.equal(p.linesUnderstood, 0);
  assert.equal(p.conceptsSeen, 0);
  assert.equal(p.conceptsMastered, 0);
  assert.equal(p.streak, 0);
  assert.equal(p.bestStreak, 0);
  assert.equal(p.usage.length, 0);
  assert.equal(p.heat.length, 182);
  assert.equal(p.heat[181], 0);
  assert.equal(p.lastActive, undefined);
});

test('computeProfile aggregates all-understood events correctly', () => {
  const events = [
    ev({ ts: '2026-07-11T09:00:00Z', lines: 5, outcome: 'understood' }),
    ev({ ts: '2026-07-11T09:05:00Z', lines: 10, outcome: 'understood' }),
    ev({ ts: '2026-07-11T09:10:00Z', lines: 15, outcome: 'understood' }),
  ];
  const p = computeProfile(events, '2026-07-11');
  assert.equal(p.reviews, 3);
  assert.equal(p.understood, 3);
  assert.equal(p.linesUnderstood, 30);
  assert.equal(p.needsReview, 0);
});

test('computeProfile buckets unknown sourceApp as Other', () => {
  const events = [
    ev({ ts: '2026-07-11T09:00:00Z', outcome: 'reviewed', sourceApp: 'SomeRandomApp' }),
  ];
  const p = computeProfile(events, '2026-07-11');
  assert.equal(p.usage.length, 1);
  assert.equal(p.usage[0].label, 'Other');
  assert.equal(p.usage[0].pct, 100);
});

test('computeProfile concept mastery uses latest outcome', () => {
  const events = [
    ev({ ts: '2026-07-10T09:00:00Z', outcome: 'needs_review', concept: 'closures', conceptLabel: 'Closures' }),
    ev({ ts: '2026-07-11T09:00:00Z', outcome: 'understood', concept: 'closures', conceptLabel: 'Closures' }),
  ];
  const p = computeProfile(events, '2026-07-11');
  assert.equal(p.conceptsSeen, 1);
  assert.equal(p.conceptsMastered, 1);
});

test('computeFeed returns most-recent first', () => {
  const events = [ev({ id: 'a', ts: '2026-07-11T08:00:00Z' }), ev({ id: 'b', ts: '2026-07-11T09:00:00Z' })];
  const feed = computeFeed(events, 5);
  assert.equal(feed[0].id, 'b');
  assert.equal(feed.length, 2);
});
