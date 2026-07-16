import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSkills } from '../src/data/skills';
import type { EventRecord } from '../src/data/types';

function event(id: string, outcome: EventRecord['outcome'], conceptLabel = 'React Hooks'): EventRecord {
  return {
    id,
    userId: 'learner',
    ts: `2026-07-${id.padStart(2, '0')}T10:00:00Z`,
    scope: 'selection',
    level: 'intermediate',
    outcome,
    concept: 'react-hooks',
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
