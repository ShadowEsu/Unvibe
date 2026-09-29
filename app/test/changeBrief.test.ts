import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChangeBrief, hunkStats } from '../src/core/changeBrief';
import { parseUnifiedDiff } from '../src/core/gitDiff';
import { buildOriginReport } from '../src/core/codeOrigin';
import { freshnessFromChange, hashCode, pathImportance } from '../src/core/knowledge';
import { gradeTeachBack } from '../src/core/teachBack';
import { coverageFromEvidence, knowledgeRisk, understandingGap } from '../src/core/understandingMetrics';

const DIFF = `diff --git a/auth/session.ts b/auth/session.ts
--- a/auth/session.ts
+++ b/auth/session.ts
@@ -1,2 +1,3 @@
 keep
-old
+new session cache
`;

test('change brief uses git hunks and never claims AI authorship', () => {
  const hunks = parseUnifiedDiff(DIFF);
  const brief = buildChangeBrief({ repo: '/tmp/demo', scope: 'working', hunks });
  assert.equal(brief.filesChanged, 1);
  assert.equal(brief.architectureImpact, 'HIGH');
  assert.match(brief.provenanceNote, /does not know whether an agent/);
  assert.equal(brief.empty, false);
});

test('empty hunks produce an empty brief', () => {
  const brief = buildChangeBrief({ repo: '/tmp/demo', scope: 'staged', hunks: [] });
  assert.equal(brief.empty, true);
  assert.equal(brief.filesChanged, 0);
});

test('hunkStats ignore diff headers', () => {
  const stats = hunkStats(parseUnifiedDiff(DIFF));
  assert.equal(stats.insertions, 1);
  assert.equal(stats.deletions, 1);
});

test('origin report refuses to invent history', () => {
  const report = buildOriginReport({ file: 'a.ts', lineStart: 1, lineEnd: 2 });
  assert.equal(report.inference, 'No documented rationale found.');
  assert.ok(report.missing.includes('introducing commit'));
});

test('freshness is change driven', () => {
  assert.equal(hashCode('a'), hashCode('a'));
  assert.notEqual(hashCode('a'), hashCode('b'));
  assert.equal(freshnessFromChange(0.05, 1), 'CURRENT');
  assert.equal(freshnessFromChange(0.5, 1), 'STALE');
  assert.ok(pathImportance('auth/session.ts') > pathImportance('readme.md'));
});

test('teach back is evidence not a score', () => {
  const thin = gradeTeachBack('', 'ok');
  assert.equal(thin.evidence, 'NOT_ENOUGH');
  const result = gradeTeachBack(
    'Redis stores sessions so workers stay stateless. Token invalidation still happens on logout.',
    'We use Redis so sessions can be shared and workers stay stateless.',
  );
  assert.ok(result.checks.length > 0);
  assert.match(result.note, /not an intelligence score/);
});

test('coverage stays honest with no data', () => {
  assert.equal(coverageFromEvidence([]).score, null);
  assert.ok((coverageFromEvidence(['teachback', 'confirmed']).score ?? 0) > 20);
  assert.equal(knowledgeRisk({ missing: 80, concentration: 80, stale: 80, unreviewed: 80 }).label, 'CRITICAL');
  assert.equal(understandingGap(43, 21), 22);
});
