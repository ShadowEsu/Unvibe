import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { DiffHunk } from './protocol';

const pexecFile = promisify(execFile);
const MAX_BUFFER = 12 * 1024 * 1024;
const MAX_UNTRACKED_FILES = 20;
const MAX_UNTRACKED_LINES = 200;
const MAX_UNTRACKED_BYTES = 80_000;

/** Parse unified `git diff` output into structured hunks. */
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
  }
  return hunks;
}

function stripDiffPrefix(pathName: string): string {
  if (pathName === '/dev/null') return pathName;
  if (pathName.startsWith('a/') || pathName.startsWith('b/')) return pathName.slice(2);
  return pathName;
}

async function untrackedAsHunks(repoRoot: string): Promise<DiffHunk[]> {
  try {
    const { stdout } = await pexecFile('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: repoRoot,
      maxBuffer: MAX_BUFFER,
    });
    const files = stdout
      .split(/\r?\n/)
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, MAX_UNTRACKED_FILES);

    const hunks: DiffHunk[] = [];
    for (const file of files) {
      try {
        const abs = path.join(repoRoot, file);
        const text = await readFile(abs, 'utf8');
        if (text.length > MAX_UNTRACKED_BYTES) continue;
        const body = text.split(/\r?\n/).slice(0, MAX_UNTRACKED_LINES);
        hunks.push({
          file,
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: body.length,
          lines: body.map((line) => `+${line}`),
        });
      } catch {
        /* skip unreadable */
      }
    }
    return hunks;
  } catch {
    return [];
  }
}

/** Working-tree diff relative to HEAD (staged + unstaged + capped untracked). */
export async function getWorkingTreeDiff(repoRoot: string, files?: string[]): Promise<DiffHunk[]> {
  const fileArgs = files && files.length ? ['--', ...files] : [];
  let tracked: DiffHunk[] = [];
  try {
    const { stdout } = await pexecFile('git', ['diff', '--unified=3', '--no-color', 'HEAD', ...fileArgs], {
      cwd: repoRoot,
      maxBuffer: MAX_BUFFER,
    });
    tracked = parseUnifiedDiff(stdout);
  } catch {
    const { stdout } = await pexecFile('git', ['diff', '--unified=3', '--no-color', ...fileArgs], {
      cwd: repoRoot,
      maxBuffer: MAX_BUFFER,
    });
    tracked = parseUnifiedDiff(stdout);
  }

  // Untracked files are common after agent runs; include them when scanning the whole tree.
  if (!files?.length) {
    const untracked = await untrackedAsHunks(repoRoot);
    const seen = new Set(tracked.map((h) => h.file));
    for (const h of untracked) {
      if (!seen.has(h.file)) tracked.push(h);
    }
  }
  return tracked;
}

export function capHunks(hunks: DiffHunk[], maxHunks = 40, maxLinesPerHunk = 200): DiffHunk[] {
  return hunks.slice(0, maxHunks).map((h) => ({ ...h, lines: h.lines.slice(0, maxLinesPerHunk) }));
}

export async function findGitRoot(startDir: string): Promise<string | null> {
  try {
    const { stdout } = await pexecFile('git', ['rev-parse', '--show-toplevel'], { cwd: startDir });
    const root = stdout.trim();
    return root || null;
  } catch {
    return null;
  }
}
