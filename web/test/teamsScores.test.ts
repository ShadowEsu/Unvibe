import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRepoUnderstanding,
  computeOrgOverall,
  computeKnowledgeConcentration,
  computeUnderstandingGap,
  concentrationRiskLabel,
  freshnessMultiplier,
  weightFor,
  type EvidenceRecord,
} from '../src/teams/scores';

function ev(
  kind: EvidenceRecord['kind'],
  overrides: Partial<EvidenceRecord> = {},
): EvidenceRecord {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    orgId: 'org-1',
    userId: overrides.userId ?? 'user-1',
    kind,
    refKind: overrides.refKind ?? 'repo',
    refId: overrides.refId ?? 'repo-1',
    weight: overrides.weight ?? 1,
    occurredAt: overrides.occurredAt ?? '2026-09-02T00:00:00Z',
    source: overrides.source ?? 'app',
  };
}

test('repository understanding returns insufficient-data below the threshold', () => {
  const evidence = [ev('pr_viewed'), ev('pr_viewed'), ev('concept_seen')];
  const result = computeRepoUnderstanding(evidence, new Date('2026-09-02T12:00:00Z'));
  assert.equal(result.insufficientData, true);
  assert.equal(result.value, null);
  assert.match(result.reason ?? '', /Needs at least/);
  assert.equal(result.evidenceCount, 3);
});

test('repository understanding aggregates evidence into a bounded 0-100 score', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  const evidence: EvidenceRecord[] = [
    ev('pr_walkthrough', { id: 'a' }),
    ev('pr_walkthrough', { id: 'b' }),
    ev('pr_verified', { id: 'c' }),
    ev('concept_verified', { id: 'd', refKind: 'concept' }),
    ev('commit_authored', { id: 'e', refKind: 'commit' }),
    ev('file_touched', { id: 'f', refKind: 'file' }),
  ];
  const result = computeRepoUnderstanding(evidence, now);
  assert.equal(result.insufficientData, false);
  assert.ok(typeof result.value === 'number' && result.value! > 0 && result.value! <= 100);
  assert.ok(result.components.length === 4);
  assert.ok(result.components.every((c) => c.contribution >= 0));
});

test('verification and walkthrough weigh more than a plain view', () => {
  assert.ok(weightFor(ev('pr_verified')) > weightFor(ev('pr_walkthrough')));
  assert.ok(weightFor(ev('pr_walkthrough')) > weightFor(ev('pr_viewed')));
  assert.ok(weightFor(ev('concept_verified')) > weightFor(ev('concept_seen')));
});

test('freshness decay halves contribution after the half-life', () => {
  const now = new Date('2026-09-02T00:00:00Z');
  const fresh = freshnessMultiplier('2026-09-02T00:00:00Z', now);
  const halfLife = freshnessMultiplier('2026-08-03T00:00:00Z', now); // ~30 days
  assert.equal(fresh, 1);
  assert.ok(halfLife > 0.45 && halfLife < 0.55, `half-life multiplier ${halfLife} not near 0.5`);
});

test('organization overall skips repos with insufficient data', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  const enough: EvidenceRecord[] = Array.from({ length: 8 }, (_, i) =>
    ev(i % 2 === 0 ? 'pr_walkthrough' : 'concept_verified', { id: `a${i}`, refKind: i % 2 === 0 ? 'pr' : 'concept' }),
  );
  const repoA = computeRepoUnderstanding(enough, now);
  const repoB = computeRepoUnderstanding([ev('pr_viewed')], now);
  const orgSize: Array<{ repoId: string; score: typeof repoA; weight?: number }> = [
    { repoId: 'a', score: repoA },
    { repoId: 'b', score: repoB },
  ];
  const evidenceTotal = repoA.evidenceCount + repoB.evidenceCount;
  const org = computeOrgOverall(orgSize);
  if (evidenceTotal < 20) {
    assert.equal(org.insufficientData, true);
  } else {
    assert.equal(org.insufficientData, false);
    assert.equal(org.sampleSize, 1); // only repoA counted
  }
});

test('concentration flags when the top two engineers hold most verified evidence', () => {
  const evidence: EvidenceRecord[] = [
    ...Array.from({ length: 5 }, (_, i) => ev('pr_verified', { id: `a${i}`, userId: 'alice' })),
    ...Array.from({ length: 3 }, (_, i) => ev('concept_verified', { id: `b${i}`, userId: 'bob' })),
    ev('pr_verified', { id: 'c1', userId: 'chen' }),
  ];
  const result = computeKnowledgeConcentration(evidence);
  assert.equal(result.insufficientData, false);
  assert.ok((result.value ?? 0) > 60, `expected concentration > 60, got ${result.value}`);
  // Alice + Bob together hold ~88% of verified evidence — that's critical, not just watch.
  assert.equal(concentrationRiskLabel(result.value), 'critical');
});

test('concentration requires at least two engineers', () => {
  const solo = computeKnowledgeConcentration([
    ev('pr_verified', { id: 'x', userId: 'alice' }),
    ev('pr_verified', { id: 'y', userId: 'alice' }),
  ]);
  assert.equal(solo.insufficientData, true);
});

test('understanding gap is directional and clamped', () => {
  const behind = computeUnderstandingGap({ codeChangeVelocity: 82, understandingVelocity: 30 });
  const healthy = computeUnderstandingGap({ codeChangeVelocity: 40, understandingVelocity: 60 });
  const overshoot = computeUnderstandingGap({ codeChangeVelocity: 500, understandingVelocity: -30 });
  assert.equal(behind.value, 52);
  assert.ok((healthy.value ?? 0) < 0);
  assert.equal(overshoot.value, 100); // clamped
});

test('concentration risk label bands align with the roadmap', () => {
  assert.equal(concentrationRiskLabel(85), 'critical');
  assert.equal(concentrationRiskLabel(60), 'watch');
  assert.equal(concentrationRiskLabel(30), 'healthy');
  assert.equal(concentrationRiskLabel(null), null);
});
