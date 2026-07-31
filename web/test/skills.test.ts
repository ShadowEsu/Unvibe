import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSkills } from '../src/data/skills';
import type { EventRecord } from '../src/data/types';

function event(
  id: string,
  outcome: EventRecord['outcome'],
  conceptLabel = 'React Hooks',
  concept = 'react-hooks',
): EventRecord {
  return {
    id,
    userId: 'learner',
    ts: `2026-07-${id.padStart(2, '0')}T10:00:00Z`,
    scope: 'selection',
    level: 'intermediate',
    outcome,
    concept,
    conceptLabel,
    project: 'desktop',
    language: 'TypeScript',
  };
}

test('skills use stable normalized identity and cautious evidence states', () => {
  const first = computeSkills('learner', [event('1', 'understood'), event('2', 'understood', ' react   hooks ')]);
  const second = computeSkills('learner', [event('1', 'understood'), event('2', 'understood'), event('3', 'understood')]);
  assert.equal(first[0].id, second[0].id);
  assert.equal(first[0].evidenceState, 'familiar');
  assert.equal(second[0].evidenceState, 'strong');
  assert.equal(second[0].successfulChecks, 3);
  assert.deepEqual(second[0].relatedProjects, ['desktop']);
});

test('latest unsuccessful evidence prevents a mastery-like claim', () => {
  const skills = computeSkills('learner', [
    event('1', 'understood'),
    event('2', 'understood'),
    event('3', 'understood'),
    event('4', 'needs_review'),
  ]);
  assert.equal(skills[0].evidenceState, 'needs_review');
  assert.equal(skills[0].nextReviewDate, '2026-07-04');
});

test('concepts key on the machine-facing slug, not the display label', () => {
  // Same slug, label phrasing drift (e.g. model rephrasing between sessions) — one skill.
  const skills = computeSkills('learner', [
    event('1', 'understood', 'Async fetch handling', 'async-fetch'),
    event('2', 'understood', 'async-fetching', 'async-fetch'),
  ]);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].normalizedName, 'async-fetch');
  assert.equal(skills[0].successfulChecks, 2);
  assert.equal(skills[0].displayName, 'async-fetching');
});

test('distinct slugs stay distinct even when labels read alike', () => {
  const skills = computeSkills('learner', [
    event('1', 'understood', 'Promises', 'promises'),
    event('2', 'understood', 'Promises', 'promise-all'),
  ]);
  assert.equal(skills.length, 2);
  assert.deepEqual(skills.map((s) => s.normalizedName).sort(), ['promise-all', 'promises']);
  assert.equal(skills[0].successfulChecks, 1);
  assert.equal(skills[1].successfulChecks, 1);
});

test('label-only events fall back to the normalized label and stay stable', () => {
  const skills = computeSkills('learner', [
    event('1', 'understood', '  Closures   in JS ', ''),
    event('2', 'understood', 'closures in js', ''),
  ]);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].normalizedName, 'closures in js');
  assert.equal(skills[0].successfulChecks, 2);
});
