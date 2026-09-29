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

export type GitDiffScope = 'working' | 'staged' | 'latest' | 'branch';

async function gitText(repoRoot: string, args: string[]): Promise<string> {
  const { stdout } = await pexecFile('git', args, { cwd: repoRoot, maxBuffer: MAX_BUFFER });
  return stdout;
}

export async function getStagedDiff(repoRoot: string): Promise<DiffHunk[]> {
  try {
    const stdout = await gitText(repoRoot, ['diff', '--cached', '--unified=3', '--no-color']);
    return parseUnifiedDiff(stdout);
  } catch {
    return [];
  }
}

export async function getLatestCommitDiff(repoRoot: string): Promise<DiffHunk[]> {
  try {
    const stdout = await gitText(repoRoot, ['show', '--unified=3', '--no-color', '--pretty=format:', 'HEAD']);
    const hunks = parseUnifiedDiff(stdout);
    if (hunks.length) return hunks;
  } catch {
    /* first commit or empty */
  }
  try {
    const stdout = await gitText(repoRoot, ['diff', '--unified=3', '--no-color', 'HEAD~1', 'HEAD']);
    return parseUnifiedDiff(stdout);
  } catch {
    return [];
  }
}

export async function detectBaseRef(repoRoot: string): Promise<string | null> {
  const candidates = ['@{upstream}', 'origin/main', 'origin/master', 'main', 'master'];
  for (const ref of candidates) {
    try {
      const sha = (await gitText(repoRoot, ['rev-parse', '--verify', ref])).trim();
      if (sha) return ref;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function getBranchDiff(repoRoot: string): Promise<DiffHunk[]> {
  const base = await detectBaseRef(repoRoot);
  if (!base) return [];
  try {
    const mergeBase = (await gitText(repoRoot, ['merge-base', 'HEAD', base])).trim();
    if (!mergeBase) return [];
    const stdout = await gitText(repoRoot, ['diff', '--unified=3', '--no-color', `${mergeBase}...HEAD`]);
    return parseUnifiedDiff(stdout);
  } catch {
    return [];
  }
}

export async function collectDiffHunks(repoRoot: string, scope: GitDiffScope): Promise<DiffHunk[]> {
  if (scope === 'staged') return getStagedDiff(repoRoot);
  if (scope === 'latest') return getLatestCommitDiff(repoRoot);
  if (scope === 'branch') return getBranchDiff(repoRoot);
  return getWorkingTreeDiff(repoRoot);
}

export async function gitHeadState(repoRoot: string): Promise<{ branch: string; detached: boolean }> {
  try {
    const raw = (await gitText(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    if (raw === 'HEAD') return { branch: 'detached HEAD', detached: true };
    return { branch: raw, detached: false };
  } catch {
    return { branch: 'unknown', detached: true };
  }
}

export async function porcelainStatus(repoRoot: string): Promise<string> {
  try {
    return await gitText(repoRoot, ['status', '--porcelain']);
  } catch {
    return '';
  }
}

export interface BlameLine {
  commit: string;
  author: string;
  date: string;
  summary: string;
}

export async function blameRange(repoRoot: string, filePath: string, start: number, end: number): Promise<BlameLine | null> {
  const safeStart = Math.max(1, start);
  const safeEnd = Math.max(safeStart, end);
  try {
    const stdout = await gitText(repoRoot, [
      'blame',
      '-L',
      `${safeStart},${safeEnd}`,
      '--porcelain',
      '--',
      filePath,
    ]);
    const hash = stdout.match(/^([0-9a-f]{7,40}) /m)?.[1];
    const author = stdout.match(/^author (.+)$/m)?.[1];
    const time = stdout.match(/^author-time (\d+)$/m)?.[1];
    const summary = stdout.match(/^summary (.+)$/m)?.[1];
    if (!hash && !author) return null;
    return {
      commit: hash ?? '',
      author: author ?? '',
      date: time ? new Date(Number(time) * 1000).toISOString().slice(0, 10) : '',
      summary: summary ?? '',
    };
  } catch {
    return null;
  }
}

export interface FileCommit {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

export async function fileHistory(repoRoot: string, filePath: string, limit = 8): Promise<FileCommit[]> {
  try {
    const stdout = await gitText(repoRoot, [
      'log',
      `--max-count=${Math.max(1, Math.min(limit, 20))}`,
      '--format=%h%x09%s%x09%an%x09%ad',
      '--date=short',
      '--',
      filePath,
    ]);
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [hash, subject, author, date] = line.split('\t');
        return { hash: hash ?? '', subject: subject ?? '', author: author ?? '', date: date ?? '' };
      });
  } catch {
    return [];
  }
}

export async function readRepoFile(repoRoot: string, relativePath: string): Promise<string | null> {
  try {
    const abs = path.join(repoRoot, relativePath);
    const text = await readFile(abs, 'utf8');
    if (text.includes('\u0000')) return null;
    return text.slice(0, 80_000);
  } catch {
    return null;
  }
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
