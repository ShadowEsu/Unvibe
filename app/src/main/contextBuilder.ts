/**
 * Builds filtered review payloads in the main process (selection, diff, nearby files, compare).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { capHunks, findGitRoot, getWorkingTreeDiff } from '../core/gitDiff';
import { extractImports, relativeImportPaths } from '../core/parse';
import { guessLanguage } from '../core/language';
import type { DiffHunk, ExplanationLevel, ReviewRequestPayload, ReviewScope } from '../core/protocol';
import { store } from './store';
import { settings } from './settings';

const MAX_NEARBY_CHARS = 8_000;
const MAX_SNAPSHOT_CHARS = 12_000;

export type ReviewMode = 'selection' | 'diff' | 'brief' | 'compare';

export interface BuiltReview {
  payload: ReviewRequestPayload;
  displayCode: string;
  file?: string;
  project?: string;
  /** Absolute path to the source file when known (for reopen / nearby). */
  sourceFilePath?: string;
  /** Raw file text for "since last understood" snapshots — never diff/compare display blobs. */
  snapshotText?: string;
  lines: number;
  language: string;
  mode: ReviewMode;
}

function isInsideRepo(repoRoot: string, candidate: string): boolean {
  const rel = path.relative(path.resolve(repoRoot), path.resolve(candidate));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function projectName(repoRoot: string): string {
  return path.basename(repoRoot);
}

async function readNearbyFiles(repoRoot: string, fromFile: string, code: string): Promise<{ imports: string[]; enclosing?: string }> {
  const importLines = extractImports(code);
  const rels = relativeImportPaths(importLines, 4);
  const snippets: string[] = [];
  const resolved: string[] = [];
  const baseDir = path.dirname(path.join(repoRoot, fromFile));

  for (const rel of rels) {
    if (resolved.length >= 2) break;
    const candidates = [
      path.resolve(baseDir, rel),
      path.resolve(baseDir, `${rel}.ts`),
      path.resolve(baseDir, `${rel}.tsx`),
      path.resolve(baseDir, `${rel}.js`),
      path.resolve(baseDir, `${rel}/index.ts`),
    ];
    for (const candidate of candidates) {
      if (!isInsideRepo(repoRoot, candidate)) continue;
      try {
        const text = await readFile(candidate, 'utf8');
        const clipped = text.slice(0, Math.floor(MAX_NEARBY_CHARS / 2));
        const relPath = path.relative(repoRoot, candidate);
        snippets.push(`### ${relPath}\n\`\`\`\n${clipped}\n\`\`\``);
        resolved.push(relPath);
        break;
      } catch {
        /* try next */
      }
    }
  }

  return {
    imports: [...importLines.slice(0, 30), ...resolved.map((p) => `nearby:${p}`)],
    enclosing: snippets.length ? snippets.join('\n\n') : undefined,
  };
}

export async function resolveRepoRoot(preferred?: string): Promise<string | null> {
  if (preferred) {
    const root = await findGitRoot(preferred);
    if (root) {
      settings().set({ lastProjectRoot: root });
      return root;
    }
  }
  const remembered = settings().all().lastProjectRoot;
  if (remembered) {
    const root = await findGitRoot(remembered);
    if (root) return root;
  }
  return null;
}

export async function buildSelectionPayload(opts: {
  code: string;
  level: ExplanationLevel;
  filePath?: string;
  repoRoot?: string | null;
  withNearby: boolean;
  question?: string;
  variant?: 'default' | 'different';
}): Promise<BuiltReview> {
  const repoRoot = opts.repoRoot ?? (opts.filePath ? await resolveRepoRoot(path.dirname(opts.filePath)) : await resolveRepoRoot());
  const relFile = opts.filePath && repoRoot
    ? path.relative(repoRoot, opts.filePath)
    : opts.filePath ? path.basename(opts.filePath) : undefined;

  let imports: string[] = extractImports(opts.code);
  let enclosing: string | undefined;
  if (opts.withNearby && repoRoot && relFile) {
    const nearby = await readNearbyFiles(repoRoot, relFile, opts.code);
    imports = nearby.imports;
    enclosing = nearby.enclosing;
  }

  const language = opts.filePath
    ? guessLanguage(opts.code) // keep simple; path-aware later
    : guessLanguage(opts.code);

  const payload: ReviewRequestPayload = {
    scope: 'selection',
    level: opts.level,
    question: opts.question,
    variant: opts.variant ?? 'default',
    context: {
      language,
      primaryFile: relFile,
      projectStructure: repoRoot ? [projectName(repoRoot)] : [],
      imports,
      code: opts.code,
      enclosing,
      selection: relFile ? { file: relFile, startLine: 1, endLine: opts.code.split('\n').length } : undefined,
    },
  };

  return {
    payload,
    displayCode: opts.code,
    file: relFile,
    project: repoRoot ? projectName(repoRoot) : undefined,
    sourceFilePath: opts.filePath,
    snapshotText: opts.filePath ? opts.code.slice(0, MAX_SNAPSHOT_CHARS) : undefined,
    lines: opts.code.split('\n').length,
    language,
    mode: 'selection',
  };
}

function diffAsDisplay(hunks: DiffHunk[]): string {
  return hunks
    .slice(0, 12)
    .map((h) => `// ${h.file}\n${h.lines.slice(0, 80).join('\n')}`)
    .join('\n\n')
    .slice(0, 40_000);
}

export async function buildDiffPayload(opts: {
  repoRoot: string;
  level: ExplanationLevel;
  mode: 'diff' | 'brief';
  question?: string;
}): Promise<BuiltReview> {
  const hunks = capHunks(await getWorkingTreeDiff(opts.repoRoot));
  if (hunks.length === 0) {
    throw new Error('No uncommitted changes in this repository.');
  }
  const displayCode = diffAsDisplay(hunks);
  const primary = hunks[0]!.file;
  const briefQuestion = opts.mode === 'brief'
    ? 'Agent change brief: Summarize what an AI agent or developer changed, why it matters, risks, and the top concepts to learn. Keep it skimmable.'
    : opts.question;

  const payload: ReviewRequestPayload = {
    scope: 'diff',
    level: opts.level,
    question: briefQuestion,
    context: {
      language: guessLanguage(displayCode),
      primaryFile: primary,
      projectStructure: [projectName(opts.repoRoot)],
      imports: [],
      code: displayCode,
      diffHunks: hunks,
    },
  };

  return {
    payload,
    displayCode,
    file: primary,
    project: projectName(opts.repoRoot),
    lines: displayCode.split('\n').length,
    language: payload.context.language,
    mode: opts.mode,
  };
}

/** Compare current file to the last locally understood snapshot (Pro). */
export async function buildComparePayload(opts: {
  filePath: string;
  level: ExplanationLevel;
  repoRoot?: string | null;
}): Promise<BuiltReview> {
  const current = await readFile(opts.filePath, 'utf8');
  const repoRoot = opts.repoRoot ?? await resolveRepoRoot(path.dirname(opts.filePath));
  const relFile = repoRoot ? path.relative(repoRoot, opts.filePath) : path.basename(opts.filePath);
  const project = repoRoot ? projectName(repoRoot) : undefined;

  const prior = store().events()
    .filter((e) => e.outcome === 'understood' && e.file === relFile && (!project || e.project === project))
    .sort((a, b) => b.ts.localeCompare(a.ts))[0];

  const snapshot = store().fileSnapshot(relFile, project);
  const previous = snapshot?.text;

  if (!previous) {
    // Do not write a snapshot yet — "Got it" / quiz-correct establishes the baseline.
    const first = await buildSelectionPayload({
      code: current.slice(0, MAX_SNAPSHOT_CHARS),
      level: opts.level,
      filePath: opts.filePath,
      repoRoot,
      withNearby: true,
      question: prior
        ? 'You marked this file understood before, but no local snapshot was kept. Explain the current file and note what to re-check.'
        : 'First pass on this file. Explain it clearly, then tap Got it so future compares have a baseline.',
    });
    return { ...first, mode: 'compare', snapshotText: current.slice(0, MAX_SNAPSHOT_CHARS) };
  }

  const combined = [
    '## Previously understood version (local snapshot)',
    '```',
    previous.slice(0, MAX_SNAPSHOT_CHARS / 2),
    '```',
    '',
    '## Current version',
    '```',
    current.slice(0, MAX_SNAPSHOT_CHARS / 2),
    '```',
  ].join('\n');

  const payload: ReviewRequestPayload = {
    scope: 'file',
    level: opts.level,
    question: 'What changed since I last understood this file? Focus on behavior, risks, and what I should re-learn.',
    context: {
      language: guessLanguage(current),
      primaryFile: relFile,
      projectStructure: project ? [project] : [],
      imports: extractImports(current),
      code: combined,
    },
  };

  return {
    payload,
    displayCode: combined,
    file: relFile,
    project,
    sourceFilePath: opts.filePath,
    snapshotText: current.slice(0, MAX_SNAPSHOT_CHARS),
    lines: current.split('\n').length,
    language: payload.context.language,
    mode: 'compare',
  };
}

export function isProPlan(plan: string): boolean {
  return plan === 'pro' || plan === 'teams' || plan === 'full';
}

export function scopeLabel(scope: ReviewScope | ReviewMode): string {
  if (scope === 'brief') return 'Agent brief';
  if (scope === 'compare') return 'Since last understood';
  if (scope === 'diff') return 'Git diff';
  return 'Selection';
}
