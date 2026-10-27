import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { capHunks, findGitRoot, parseUnifiedDiff, repoRelativePath } from '../src/core/gitDiff';

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

test('a file opened through a linked folder keeps only its path inside the repo', async () => {
  const base = mkdtempSync(path.join(tmpdir(), 'unvibe-relpath-'));
  try {
    const repo = path.join(base, 'real', 'shop');
    mkdirSync(path.join(repo, 'src'), { recursive: true });
    writeFileSync(path.join(repo, 'src', 'cart.js'), 'export const total = 0;\n');
    execFileSync('git', ['init', '-q'], { cwd: repo });
    const link = path.join(base, 'code');
    symlinkSync(path.join(base, 'real'), link, 'junction');
    const opened = path.join(link, 'shop', 'src', 'cart.js');
    // git reports the root with the link resolved, as on a real machine.
    const root = await findGitRoot(path.dirname(opened));
    assert.ok(root);
    assert.equal(repoRelativePath(root, opened), path.join('src', 'cart.js'));
    // A file outside the repo never sends the folders above the project: only its name.
    const outside = path.join(base, 'notes.js');
    writeFileSync(outside, '\n');
    assert.equal(repoRelativePath(root, outside), 'notes.js');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('a git repo at the home folder is never the project, but a repo inside home is', async () => {
  const home = mkdtempSync(path.join(tmpdir(), 'unvibe-home-'));
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    execFileSync('git', ['init', '-q'], { cwd: home });
    const code = path.join(home, 'code');
    mkdirSync(code);
    writeFileSync(path.join(code, 'a.js'), '\n');
    // A dotfiles repo at ~ would make the project name the OS username.
    assert.equal(await findGitRoot(code), null);
    const shop = path.join(code, 'shop');
    mkdirSync(shop);
    execFileSync('git', ['init', '-q'], { cwd: shop });
    const root = await findGitRoot(shop);
    assert.ok(root);
    assert.equal(path.basename(root), 'shop');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(home, { recursive: true, force: true });
  }
});
