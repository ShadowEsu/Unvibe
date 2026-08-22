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
  codeSelections: 20,
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

/** Teams is opt-in at deploy time: Stripe price IDs are the final safety gate. */
export function teamsCheckoutEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.STRIPE_PRICE_TEAMS_MONTHLY?.trim() && env.STRIPE_PRICE_TEAMS_ANNUAL?.trim());
}

const MONTHLY_UNIT_AMOUNT = 800;
const ANNUAL_UNIT_AMOUNT = 7_200;

export function priceFor(plan: PlanId, interval: 'monthly' | 'annual', seats = 1): number {
  if (plan === 'free') return 0;
  const normalized = normalizedSeats(plan, seats);
  return (interval === 'annual' ? ANNUAL_UNIT_AMOUNT : MONTHLY_UNIT_AMOUNT) * normalized;
}

export function proAnnualSavingsPercent(): number {
  return Math.round((1 - ANNUAL_UNIT_AMOUNT / (MONTHLY_UNIT_AMOUNT * 12)) * 100);
}

export function teamsAnnualSavingsPercent(): number {
  return proAnnualSavingsPercent();
}

export function normalizedSeats(plan: Exclude<PlanId, 'free'>, requested: number): number {
  if (plan === 'pro') return 1;
  if (!Number.isFinite(requested)) throw new Error('Teams requires a valid seat quantity.');
  if (!Number.isInteger(requested)) throw new Error('Teams seats must be a whole number.');
  if (requested < 2) throw new Error('Teams requires at least 2 seats.');
  if (requested > 500) throw new Error('Teams supports at most 500 seats.');
  return requested;
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
