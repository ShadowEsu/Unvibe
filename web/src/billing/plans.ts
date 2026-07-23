/**
 * Private beta plan. Sized deliberately below the eventual Free plan (roughly 80% of what
 * Free is expected to offer at general availability) so beta testers get a generous, honest
 * preview without us promising more than Free will actually include at launch.
 *
 * Quiz ("Test me"), history, profile, and project views are unmetered — only the two AI-cost
 * actions are capped.
 */
export const BETA_PLAN = {
  /** A "code selection" is a fresh explanation of a new piece of selected code. */
  codeSelections: 30,
  /** An "AI ask" is a follow-up question or an "Explain differently" on an existing explanation. */
  aiAsks: 20,
} as const;

export type UsageKind = 'selection' | 'ask';

export function limitFor(kind: UsageKind): number {
  return kind === 'selection' ? BETA_PLAN.codeSelections : BETA_PLAN.aiAsks;
}

export function quotaMessage(kind: UsageKind, limit: number): string {
  return kind === 'selection'
    ? `You've used all ${limit} free code explanations included in the beta.`
    : `You've used all ${limit} free follow-up questions included in the beta.`;
}
