/**
 * After-agent review checklists live in the renderer's localStorage, keyed by repository name and
 * review headline. They describe the person's projects, so deleting the account removes them.
 */
const PREFIX = 'unvibe.agentReview.';

export function reviewChecklistKey(repo: string, headline: string): string {
  return `${PREFIX}${repo}.${headline}`;
}

/** Removes every saved checklist. Other keys (panel theme, feedback prompt) stay. */
export function clearReviewChecklists(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
