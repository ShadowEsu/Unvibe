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

import type { PlanId, SubscriptionStatus, UsageKind as BillingUsageKind, WorkspaceRole } from './types';

export type UsageKind = 'selection' | 'ask';

export function limitFor(kind: UsageKind): number {
  return kind === 'selection' ? BETA_PLAN.codeSelections : BETA_PLAN.aiAsks;
}

export function quotaMessage(kind: UsageKind, limit: number): string {
  return kind === 'selection'
    ? `You've used all ${limit} free code explanations included in the beta.`
    : `You've used all ${limit} free follow-up questions included in the beta.`;
}

/** Billing helpers mirror the limits and access rules in the Supabase migration. */
const BILLING_LIMITS: Record<PlanId, Record<BillingUsageKind, number>> = {
  free: { ai_explanation: 50, project_question: 10, indexed_project: 1, dictionary_item: 25, saved_item: 20 },
  pro: { ai_explanation: 100, project_question: 500, indexed_project: 10, dictionary_item: 1000, saved_item: 1000 },
  teams: { ai_explanation: 100, project_question: 500, indexed_project: 10, dictionary_item: 1000, saved_item: 1000 },
};

export const TEAMS_CHECKOUT_ENABLED = false;

export function normalizedSeats(plan: Exclude<PlanId, 'free'>, requested: number): number {
  if (plan === 'pro') return 1;
  if (!Number.isFinite(requested)) return 2;
  return Math.max(2, Math.min(500, Math.floor(requested)));
}

export function effectivePlan(plan: PlanId, status: SubscriptionStatus, gracePeriodEndsAt?: string, now = new Date()): PlanId {
  if (plan === 'free' || status === 'trialing' || status === 'active') return plan;
  if (status === 'grace_period' && gracePeriodEndsAt && new Date(gracePeriodEndsAt) > now) return plan;
  return 'free';
}

export function monthWindow(now = new Date()): { startsAt: string; resetsAt: string } {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startsAt: startsAt.toISOString(), resetsAt: resetsAt.toISOString() };
}

export function planLimit(plan: PlanId, kind: BillingUsageKind, seats = 1): number {
  const limit = BILLING_LIMITS[plan][kind];
  return plan === 'teams' && (kind === 'ai_explanation' || kind === 'project_question')
    ? limit * Math.max(2, Math.min(500, Math.floor(seats)))
    : limit;
}

export function minimumSeatsForUsage(occupiedSeats: number, pendingInvitations: number): number {
  return Math.max(2, occupiedSeats + pendingInvitations);
}

export function canManageBilling(role: WorkspaceRole): boolean {
  return role === 'owner';
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}
