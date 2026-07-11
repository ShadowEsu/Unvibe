import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff, capHunks } from './gitDiff';

const SAMPLE = `diff --git a/src/math.ts b/src/math.ts
index 1234567..89abcde 100644
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,4 +1,5 @@
 export function add(a: number, b: number) {
-  return a + b;
+  const sum = a + b;
+  return sum;
 }
@@ -10,2 +11,3 @@ export function mul(a: number, b: number) {
   return a * b;
+  // note
 }`;

test('parses file path and two hunks', () => {
  const hunks = parseUnifiedDiff(SAMPLE);
  assert.equal(hunks.length, 2);
  assert.equal(hunks[0].file, 'src/math.ts');
  assert.equal(hunks[0].newStart, 1);
  assert.equal(hunks[0].newLines, 5);
});

test('captures added and removed lines with prefixes', () => {
  const hunks = parseUnifiedDiff(SAMPLE);
  const added = hunks[0].lines.filter((l) => l.startsWith('+'));
  const removed = hunks[0].lines.filter((l) => l.startsWith('-'));
  assert.equal(added.length, 2);
  assert.equal(removed.length, 1);
});

test('handles /dev/null (new or deleted files)', () => {
  const diff = `--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+const a = 1;
+const b = 2;`;
  const hunks = parseUnifiedDiff(diff);
  assert.equal(hunks[0].file, 'new.ts');
  assert.equal(hunks[0].lines.length, 2);
});

test('returns empty for empty diff', () => {
  assert.deepEqual(parseUnifiedDiff(''), []);
});

test('capHunks limits hunk and line counts', () => {
  const many = Array.from({ length: 100 }, () => ({
    file: 'x.ts',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: Array.from({ length: 500 }, (_, i) => ` line ${i}`),
  }));
  const capped = capHunks(many, 40, 200);
  assert.equal(capped.length, 40);
  assert.equal(capped[0].lines.length, 200);
});
