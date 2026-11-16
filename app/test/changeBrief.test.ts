import test from 'node:test';
import assert from 'node:assert/strict';
import { briefRepoLabel, buildChangeBrief, hunkStats, mainChangeLines } from '../src/core/changeBrief';
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

test('the brief names a file Added, Removed or Changed from git\'s file headers, never from the line counts', () => {
  const diff = `diff --git a/README.md b/README.md
index 1111111..2222222 100644
--- a/README.md
+++ b/README.md
@@ -3,0 +4,2 @@
+## Install
+Run the installer.
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+export const a = 1;
+export const b = 2;
diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index 4444444..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const gone = 1;
-export const too = 2;
diff --git a/was-empty.txt b/was-empty.txt
index e69de29..5555555 100644
--- a/was-empty.txt
+++ b/was-empty.txt
@@ -0,0 +1 @@
+now has a line
diff --git a/emptied.txt b/emptied.txt
index 6666666..e69de29 100644
--- a/emptied.txt
+++ b/emptied.txt
@@ -1 +0,0 @@
-the only line
diff --git "a/gone-\\303\\251.txt" "b/gone-\\303\\251.txt"
deleted file mode 100644
index 7777777..0000000
--- "a/gone-\\303\\251.txt"
+++ /dev/null
@@ -1 +0,0 @@
-au revoir
`;
  const hunks = parseUnifiedDiff(diff);
  const untracked = [{ file: 'notes/todo.md', oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, lines: ['+- call back'], change: 'added' as const }];
  const lines = mainChangeLines(hunkStats(hunks).files);
  const want = [
    'Changed README.md (2+ / 0-)',
    'Added src/new.ts (2+ / 0-)',
    'Removed src/old.ts (0+ / 2-)',
    // Still there, only its content changed: never Added or Removed.
    'Changed was-empty.txt (1+ / 0-)',
    'Changed emptied.txt (0+ / 1-)',
    // git's C-style quoting of a non-ASCII name is undone, and the file keeps its name although +++ is /dev/null.
    'Removed gone-é.txt (0+ / 1-)',
  ];
  for (const line of want) assert.ok(lines.includes(line), `${line}\n--\n${lines.join('\n')}`);
  assert.ok(!lines.some((l) => l.includes('/dev/null')), lines.join('\n'));
  const files = hunkStats([...hunks, ...untracked]).files;
  assert.equal(files.find((f) => f.path === 'notes/todo.md')?.change, 'added');
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

test('the brief shows a project under the home folder as ~/…, never the account name', () => {
  assert.equal(briefRepoLabel('/Users/sam/code/app', '/Users/sam'), '~/code/app');
  assert.equal(briefRepoLabel('/Users/sam/code/app', '/Users/sam/'), '~/code/app');
  assert.equal(briefRepoLabel('/Users/sam', '/Users/sam'), '~');
  // Git for Windows prints forward slashes while the home folder uses backslashes; case is ignored.
  assert.equal(briefRepoLabel('C:/Users/sam/app', 'C:\\Users\\sam'), '~/app');
  assert.equal(briefRepoLabel('C:\\Users\\sam\\code\\app', 'C:\\Users\\sam'), '~/code/app');
  assert.equal(briefRepoLabel('c:/users/Sam/app', 'C:\\Users\\sam'), '~/app');
  // A sibling folder that only shares the prefix is not inside home.
  assert.equal(briefRepoLabel('/Users/samuel/app', '/Users/sam'), '/Users/samuel/app');
  assert.equal(briefRepoLabel('/srv/app', '/Users/sam'), '/srv/app');
  assert.equal(briefRepoLabel('/srv/app', ''), '/srv/app');
});
