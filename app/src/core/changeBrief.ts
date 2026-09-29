import type { DiffHunk } from './protocol';

export type BriefScope = 'working' | 'staged' | 'latest' | 'branch';
export type ArchitectureImpact = 'LOW' | 'MEDIUM' | 'HIGH';

export interface BriefFile {
  path: string;
  insertions: number;
  deletions: number;
  kind: string;
}

export interface ChangeBrief {
  scope: BriefScope;
  repo: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  mainChanges: string[];
  architectureImpact: ArchitectureImpact;
  understandBeforeCommit: string[];
  files: BriefFile[];
  provenanceNote: string;
  empty: boolean;
}

const HIGH_PATH = /(auth|billing|payment|stripe|schema|migrat|infra|deploy|secret|session|oauth|webhook|crypto)/i;
const MED_PATH = /(api|route|server|sql|store|queue|redis|worker|config)/i;

export function hunkStats(hunks: DiffHunk[]): { insertions: number; deletions: number; files: BriefFile[] } {
  const byFile = new Map<string, BriefFile>();
  let insertions = 0;
  let deletions = 0;
  for (const hunk of hunks) {
    const current = byFile.get(hunk.file) ?? { path: hunk.file, insertions: 0, deletions: 0, kind: fileKind(hunk.file) };
    for (const line of hunk.lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        current.insertions += 1;
        insertions += 1;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        current.deletions += 1;
        deletions += 1;
      }
    }
    byFile.set(hunk.file, current);
  }
  return { insertions, deletions, files: [...byFile.values()].sort((a, b) => (b.insertions + b.deletions) - (a.insertions + a.deletions)) };
}

export function fileKind(filePath: string): string {
  const name = filePath.toLowerCase();
  if (name.endsWith('.md') || name.endsWith('.txt')) return 'docs';
  if (name.includes('test') || name.includes('spec')) return 'test';
  if (name.endsWith('.json') || name.endsWith('.yml') || name.endsWith('.yaml') || name.endsWith('.lock')) return 'config';
  if (HIGH_PATH.test(name)) return 'sensitive';
  if (MED_PATH.test(name)) return 'service';
  return 'code';
}

export function architectureImpact(files: BriefFile[]): ArchitectureImpact {
  const names = files.map((f) => f.path).join(' ');
  if (files.some((f) => f.kind === 'sensitive') || HIGH_PATH.test(names)) return 'HIGH';
  if (files.some((f) => f.kind === 'service') || files.length >= 8) return 'MEDIUM';
  return 'LOW';
}

export function mainChangeLines(files: BriefFile[]): string[] {
  return files.slice(0, 6).map((file) => {
    const verb = file.insertions && !file.deletions ? 'Added' : file.deletions && !file.insertions ? 'Removed' : 'Changed';
    return `${verb} ${file.path} (${file.insertions}+ / ${file.deletions}-)`;
  });
}

export function understandItems(files: BriefFile[], impact: ArchitectureImpact): string[] {
  const items: string[] = [];
  if (impact === 'HIGH') items.push('This touches auth, billing, schema, or infrastructure. Read those diffs before you commit.');
  if (files.some((f) => f.kind === 'config')) items.push('Dependency or config files changed. Confirm what the runtime now requires.');
  if (files.length >= 5) items.push('Several files moved together. Check that callers and tests still match.');
  if (files.some((f) => f.kind === 'service')) items.push('API or worker paths changed. Trace request flow before shipping.');
  if (items.length === 0) items.push('Review the listed files. Unvibe does not invent a commit rationale.');
  return items.slice(0, 4);
}

export function buildChangeBrief(input: {
  repo: string;
  scope: BriefScope;
  hunks: DiffHunk[];
}): ChangeBrief {
  const stats = hunkStats(input.hunks);
  const impact = architectureImpact(stats.files);
  const empty = stats.files.length === 0;
  return {
    scope: input.scope,
    repo: input.repo,
    filesChanged: stats.files.length,
    insertions: stats.insertions,
    deletions: stats.deletions,
    mainChanges: empty ? [] : mainChangeLines(stats.files),
    architectureImpact: impact,
    understandBeforeCommit: empty ? [] : understandItems(stats.files, impact),
    files: stats.files,
    provenanceNote: 'Built from local git. Unvibe does not know whether an agent wrote these edits.',
    empty,
  };
}
