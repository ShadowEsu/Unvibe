export interface KnowledgeCitation {
  type: 'file' | 'commit' | 'pr' | 'issue' | 'knowledge';
  ref: string;
}

export function formatCitation(citation: KnowledgeCitation): string {
  return `${citation.type}:${citation.ref}`;
}

export function analyticsPayloadSafe(payload: Record<string, unknown>): boolean {
  const banned = ['code', 'prompt', 'source', 'diff', 'token', 'key', 'secret'];
  return Object.keys(payload).every((key) => !banned.includes(key.toLowerCase()));
}
