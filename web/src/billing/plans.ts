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

/** Founding Teams seat cap. Above this is Enterprise conversation pricing. */
export const TEAMS_MAX_SEATS = 20;

/** Published totals in cents. UI copy must stay in lockstep with these numbers. */
const UNIT_CENTS: Record<PlanId, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  /** Pro $9/mo · $81/yr (25% off). */
  pro: { monthly: 900, annual: 8_100 },
  /** Teams $8/seat/mo · $72/seat/yr (25% off). */
  teams: { monthly: 800, annual: 7_200 },
};

/** Pro Lifetime one-time purchase in cents. */
export const PRO_LIFETIME_CENTS = 8_000;

export function priceFor(plan: PlanId, interval: 'monthly' | 'annual' | 'lifetime', seats: number): number {
  if (plan === 'free') return 0;
  if (interval === 'lifetime') {
    if (plan !== 'pro') throw new Error('Lifetime is only available for Pro.');
    return PRO_LIFETIME_CENTS;
  }
  const n = plan === 'pro' ? 1 : Math.max(2, Math.min(TEAMS_MAX_SEATS, Math.floor(seats)));
  return UNIT_CENTS[plan][interval] * n;
}

export function proAnnualSavingsPercent(): number {
  return 25;
}

export function teamsAnnualSavingsPercent(): number {
  return 25;
}

export function normalizedSeats(plan: Exclude<PlanId, 'free'>, requested: number): number {
  if (plan === 'pro') return 1;
  if (!Number.isFinite(requested)) return 2;
  return Math.max(2, Math.min(TEAMS_MAX_SEATS, Math.floor(requested)));
}

export function effectivePlan(
  plan: PlanId,
  status: SubscriptionStatus,
  gracePeriodEndsAt?: string,
  now = new Date(),
  currentPeriodEnd?: string,
): PlanId {
  if (status === 'trialing' && currentPeriodEnd && new Date(currentPeriodEnd) <= now) return 'free';
  if (plan === 'free' || status === 'trialing' || status === 'active') return plan;
  if (status === 'grace_period' && gracePeriodEndsAt && new Date(gracePeriodEndsAt) > now) return plan;
  return 'free';
}

export function monthWindow(now = new Date()): { startsAt: string; resetsAt: string } {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startsAt: startsAt.toISOString(), resetsAt: resetsAt.toISOString() };
}

export function planLimit(plan: PlanId, kind: BillingUsageKind, seats: number): number {
  const limit = BILLING_LIMITS[plan][kind];
  return plan === 'teams' && (kind === 'ai_explanation' || kind === 'project_question')
    ? limit * Math.max(2, Math.min(TEAMS_MAX_SEATS, Math.floor(seats)))
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
