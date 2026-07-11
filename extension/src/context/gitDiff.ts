import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiffHunk } from '../protocol';

const pexecFile = promisify(execFile);
const MAX_BUFFER = 12 * 1024 * 1024;

/** Parse unified `git diff` output into structured hunks. Pure — unit tested. */
export function parseUnifiedDiff(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentFile = '';
  let current: DiffHunk | undefined;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ ')) {
      currentFile = stripDiffPrefix(line.slice(4).trim());
      current = undefined;
      continue;
    }
    if (line.startsWith('--- ') || line.startsWith('diff --git') || line.startsWith('index ')) {
      current = undefined;
      continue;
    }
    if (line.startsWith('@@')) {
      const m = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (m) {
        current = {
          file: currentFile,
          oldStart: Number(m[1]),
          oldLines: m[2] ? Number(m[2]) : 1,
          newStart: Number(m[3]),
          newLines: m[4] ? Number(m[4]) : 1,
          lines: [],
        };
        hunks.push(current);
      }
      continue;
    }
    if (current && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      current.lines.push(line);
    }
    // Lines like "\ No newline at end of file" are ignored.
  }

  return hunks;
}

function stripDiffPrefix(path: string): string {
  if (path === '/dev/null') {
    return path;
  }
  if (path.startsWith('a/') || path.startsWith('b/')) {
    return path.slice(2);
  }
  return path;
}

/**
 * Working-tree diff relative to HEAD (captures staged + unstaged). Falls back to a plain
 * `git diff` when there is no HEAD (fresh repo with no commits).
 */
export async function getWorkingTreeDiff(repoRoot: string, files?: string[]): Promise<DiffHunk[]> {
  const fileArgs = files && files.length ? ['--', ...files] : [];
  try {
    const { stdout } = await pexecFile(
      'git',
      ['diff', '--unified=3', '--no-color', 'HEAD', ...fileArgs],
      { cwd: repoRoot, maxBuffer: MAX_BUFFER },
    );
    return parseUnifiedDiff(stdout);
  } catch {
    const { stdout } = await pexecFile(
      'git',
      ['diff', '--unified=3', '--no-color', ...fileArgs],
      { cwd: repoRoot, maxBuffer: MAX_BUFFER },
    );
    return parseUnifiedDiff(stdout);
  }
}

/** Cap hunks so we never send an unbounded diff. */
export function capHunks(hunks: DiffHunk[], maxHunks = 40, maxLinesPerHunk = 200): DiffHunk[] {
  return hunks.slice(0, maxHunks).map((h) => ({
    ...h,
    lines: h.lines.slice(0, maxLinesPerHunk),
  }));
}
