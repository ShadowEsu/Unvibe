import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProfile, computeFeed, bestStreak, currentStreak, deriveSkillState, type LocalEvent } from '../src/core/learning';

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
