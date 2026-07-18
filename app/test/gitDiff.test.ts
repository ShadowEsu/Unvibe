import test from 'node:test';
import assert from 'node:assert/strict';
import { capHunks, parseUnifiedDiff } from '../src/core/gitDiff';

const SAMPLE = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 line1
-old
+new
 line3
`;

test('parseUnifiedDiff extracts file and hunk lines', () => {
  const hunks = parseUnifiedDiff(SAMPLE);
  assert.equal(hunks.length, 1);
  assert.equal(hunks[0]!.file, 'src/a.ts');
  assert.equal(hunks[0]!.oldStart, 1);
  assert.ok(hunks[0]!.lines.some((l) => l.startsWith('+new')));
});

test('capHunks limits volume', () => {
  const hunks = parseUnifiedDiff(SAMPLE);
  const capped = capHunks(hunks, 1, 2);
  assert.equal(capped[0]!.lines.length, 2);
});

test('parseUnifiedDiff ignores binary noise between files', () => {
  const multi = `${SAMPLE}
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,1 +1,2 @@
 keep
+added
`;
  const hunks = parseUnifiedDiff(multi);
  assert.equal(hunks.length, 2);
  assert.equal(hunks[1]!.file, 'src/b.ts');
});
