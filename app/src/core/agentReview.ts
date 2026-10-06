import type { BriefFile, ChangeBrief } from './changeBrief';
import type { KnowledgeObject } from './knowledge';

/**
 * After-Agent Review: when Cursor, Claude Code or another agent leaves a pile of edits,
 * turn the local git change brief into what a person should look at first.
 * Pure and local. It ranks real files from git; it never claims to know why a change was made.
 */

export interface ReviewFile extends BriefFile {
  reason: string;
  weight: number;
}

export interface ReviewArea {
  name: string;
  files: number;
  lines: number;
  sensitive: boolean;
}

export interface StaleHit {
  id: string;
  title: string;
  file: string;
  freshness: KnowledgeObject['freshnessStatus'];
}

export interface AgentReview {
  headline: string;
  size: 'small' | 'medium' | 'large';
  whatMatters: ReviewFile[];
  areas: ReviewArea[];
  added: string[];
  removed: string[];
  reviewFirst: string[];
  staleKnowledge: StaleHit[];
}

const KIND_WEIGHT: Record<string, number> = { sensitive: 100, service: 40, code: 20, config: 15, test: 5, docs: 1 };

function reasonFor(file: BriefFile): string {
  const lines = file.insertions + file.deletions;
  if (file.kind === 'sensitive') return 'Touches auth, billing, schema or infrastructure.';
  if (file.kind === 'service') return 'API, worker or data path. Requests flow through here.';
  if (file.kind === 'config') return 'Dependencies or configuration changed.';
  if (file.insertions > 0 && file.deletions === 0) return `New code, ${file.insertions} lines added.`;
  if (file.deletions > 0 && file.insertions === 0) return `Code removed, ${file.deletions} lines.`;
  if (lines >= 80) return `Large edit, ${lines} lines changed.`;
  if (file.kind === 'test') return 'Tests changed.';
  if (file.kind === 'docs') return 'Docs changed.';
  return `${lines} lines changed.`;
}

export function rankFiles(files: BriefFile[]): ReviewFile[] {
  return files
    .map((file) => {
      const lines = file.insertions + file.deletions;
      const weight = (KIND_WEIGHT[file.kind] ?? 10) + Math.min(60, Math.log2(1 + lines) * 8);
      return { ...file, weight: Math.round(weight), reason: reasonFor(file) };
    })
    .sort((a, b) => b.weight - a.weight || a.path.localeCompare(b.path));
}

/** Group by the first meaningful folder: `src/auth/x.ts` → `auth`, `README.md` → `root`. */
export function areaOf(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  const wrappers = new Set(['src', 'app', 'lib', 'packages', 'apps', 'source']);
  let i = 0;
  while (i < parts.length - 1 && wrappers.has(parts[i]!)) i += 1;
  return i < parts.length - 1 ? parts[i]! : 'root';
}

export function groupAreas(files: BriefFile[]): ReviewArea[] {
  const map = new Map<string, ReviewArea>();
  for (const file of files) {
    const name = areaOf(file.path);
    const area = map.get(name) ?? { name, files: 0, lines: 0, sensitive: false };
    area.files += 1;
    area.lines += file.insertions + file.deletions;
    area.sensitive = area.sensitive || file.kind === 'sensitive';
    map.set(name, area);
  }
  return [...map.values()].sort((a, b) => Number(b.sensitive) - Number(a.sensitive) || b.lines - a.lines);
}

function samePath(a: string, b: string): boolean {
  const x = a.replace(/\\/g, '/').replace(/^\.?\//, '');
  const y = b.replace(/\\/g, '/').replace(/^\.?\//, '');
  return x === y || x.endsWith(`/${y}`) || y.endsWith(`/${x}`);
}

export function staleKnowledgeFor(files: BriefFile[], knowledge: KnowledgeObject[]): StaleHit[] {
  const hits: StaleHit[] = [];
  for (const item of knowledge) {
    const file = item.file;
    if (!file) continue;
    if (files.some((f) => samePath(f.path, file))) {
      hits.push({ id: item.id, title: item.title, file, freshness: item.freshnessStatus });
    }
  }
  return hits;
}

export function buildAgentReview(brief: ChangeBrief, knowledge: KnowledgeObject[] = []): AgentReview {
  const ranked = rankFiles(brief.files);
  const areas = groupAreas(brief.files);
  const total = brief.insertions + brief.deletions;
  const size: AgentReview['size'] = brief.filesChanged >= 12 || total >= 600 ? 'large' : brief.filesChanged >= 4 || total >= 120 ? 'medium' : 'small';
  const codeFiles = brief.files.filter((f) => f.kind === 'code' || f.kind === 'service' || f.kind === 'sensitive');
  const testFiles = brief.files.filter((f) => f.kind === 'test');
  const configFiles = brief.files.filter((f) => f.kind === 'config');
  const sensitive = ranked.filter((f) => f.kind === 'sensitive');
  const stale = staleKnowledgeFor(brief.files, knowledge);

  const reviewFirst: string[] = [];
  for (const file of sensitive.slice(0, 3)) reviewFirst.push(`Read ${file.path} line by line. It touches a sensitive system.`);
  const biggest = ranked.find((f) => f.kind !== 'sensitive' && f.insertions + f.deletions >= 80);
  if (biggest) reviewFirst.push(`Skim ${biggest.path}, the largest edit (${biggest.insertions + biggest.deletions} lines).`);
  if (configFiles.length) reviewFirst.push(`Check ${configFiles.map((f) => f.path).slice(0, 2).join(' and ')}. New dependencies or settings change what runs.`);
  if (codeFiles.length >= 2 && testFiles.length === 0) reviewFirst.push(`${codeFiles.length} code files changed with no test changes. Decide whether tests should move too.`);
  if (stale.length) reviewFirst.push(`${stale.length} saved explanation${stale.length === 1 ? '' : 's'} cover files that changed. Refresh them so they stay true.`);
  if (areas.length >= 3) reviewFirst.push(`The change spans ${areas.length} areas (${areas.slice(0, 3).map((a) => a.name).join(', ')}). Check the seams between them.`);
  if (reviewFirst.length === 0 && ranked[0]) reviewFirst.push(`Start with ${ranked[0].path}. It carries the most weight in this change.`);

  return {
    headline: `${brief.filesChanged} file${brief.filesChanged === 1 ? '' : 's'} changed, +${brief.insertions} / -${brief.deletions}`,
    size,
    whatMatters: ranked.slice(0, 5),
    areas: areas.slice(0, 6),
    added: brief.files.filter((f) => f.insertions > 0 && f.deletions === 0).map((f) => f.path).slice(0, 6),
    removed: brief.files.filter((f) => f.deletions > 0 && f.insertions === 0).map((f) => f.path).slice(0, 6),
    reviewFirst: reviewFirst.slice(0, 5),
    staleKnowledge: stale.slice(0, 6),
  };
}
