import { createHash } from 'node:crypto';

export type KnowledgeVisibility = 'PRIVATE' | 'TEAM';
export type KnowledgeVerification = 'AI_GENERATED' | 'HUMAN_CONFIRMED' | 'HUMAN_CORRECTED';
export type FreshnessStatus = 'CURRENT' | 'MAY_BE_STALE' | 'STALE';
export type KnowledgeObjectType = 'file' | 'symbol' | 'commit' | 'concept' | 'change_brief' | 'origin';

export interface KnowledgeObject {
  id: string;
  objectType: KnowledgeObjectType;
  objectId: string;
  title: string;
  summary: string;
  body: string;
  sourceType: string;
  sourceRefs: string[];
  visibility: KnowledgeVisibility;
  verificationStatus: KnowledgeVerification;
  createdAt: string;
  updatedAt: string;
  codeVersion: string;
  freshnessStatus: FreshnessStatus;
  confidence: number;
  repositoryId?: string;
  file?: string;
  metadata?: Record<string, string>;
}

export function hashCode(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9_]+/).filter((part) => part.length > 2));
}

export function changeRatio(previous: string, current: string): number {
  const a = tokenSet(previous);
  const b = tokenSet(current);
  if (a.size === 0 && b.size === 0) return 0;
  if (a.size === 0 || b.size === 0) return 1;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  const union = a.size + b.size - overlap;
  return union === 0 ? 0 : 1 - overlap / union;
}

export function pathImportance(filePath: string): number {
  const name = filePath.toLowerCase();
  if (/(auth|billing|payment|schema|migrat|infra|session|oauth|webhook)/.test(name)) return 1;
  if (/(api|route|store|sql|config)/.test(name)) return 0.6;
  if (/(test|spec|md$|lock$)/.test(name)) return 0.15;
  return 0.35;
}

export function freshnessFromChange(ratio: number, importance: number): FreshnessStatus {
  const weighted = ratio * (0.45 + 0.55 * importance);
  if (weighted >= 0.37) return 'STALE';
  if (weighted >= 0.14) return 'MAY_BE_STALE';
  return 'CURRENT';
}

export function refreshKnowledge(item: KnowledgeObject, currentCode: string): KnowledgeObject {
  if (!item.codeVersion) return { ...item, freshnessStatus: 'MAY_BE_STALE', updatedAt: new Date().toISOString() };
  if (hashCode(currentCode) === item.codeVersion) {
    return { ...item, freshnessStatus: 'CURRENT', updatedAt: new Date().toISOString() };
  }
  const ratio = changeRatio(item.body + ' ' + item.summary, currentCode);
  const importance = pathImportance(item.file ?? item.objectId);
  return {
    ...item,
    freshnessStatus: freshnessFromChange(ratio, importance),
    updatedAt: new Date().toISOString(),
  };
}
