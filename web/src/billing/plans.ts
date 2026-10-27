import type { BillingInterval, PlanId, SubscriptionRecord, SubscriptionStatus, UsageKind, WorkspaceRole } from './types';

/** How long after its reservation a request's usage row can still receive token counts. */
export const USAGE_TOKEN_WINDOW_MS = 15 * 60_000;

/** Far-future end date used for one-time grants (Pro Lifetime, Big Business; effectively permanent). */
export const LIFETIME_PERIOD_END = '2099-12-31T23:59:59.000Z';

/**
 * Caps a month. Billing helpers mirror the limits and access rules in the Supabase migrations
 * (plan_entitlements; the latest values are in 20261031090000_enterprise_business_tiers.sql).
 * Big Business's explanations and questions are its written fair-use limit.
 */
const BILLING_LIMITS: Record<PlanId, Record<UsageKind, number>> = {
  free: { ai_explanation: 50, project_question: 10, indexed_project: 1, dictionary_item: 25, saved_item: 20 },
  pro: { ai_explanation: 200, project_question: 500, indexed_project: 10, dictionary_item: 1000, saved_item: 1000 },
  teams: { ai_explanation: 100, project_question: 500, indexed_project: 10, dictionary_item: 1000, saved_item: 1000 },
  enterprise: { ai_explanation: 1000, project_question: 2500, indexed_project: 25, dictionary_item: 5000, saved_item: 5000 },
  business: { ai_explanation: 5000, project_question: 10000, indexed_project: 100, dictionary_item: 20000, saved_item: 20000 },
};

/** Enterprise and Big Business: sold only while BILLING_NEW_TIERS_ENABLED is exactly `true`. */
export type NewTierPlan = 'enterprise' | 'business';

export function isNewTierPlan(plan: unknown): plan is NewTierPlan {
  return plan === 'enterprise' || plan === 'business';
}

/**
 * Whether checkout and the webhook may sell and grant Enterprise and Big Business. Exactly `true`
 * (no trimming, no other spelling); off by default. The payment locks in stripe.ts still apply on top.
 */
export function newTiersEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.BILLING_NEW_TIERS_ENABLED === 'true';
}

/** The billing intervals each paid plan is sold on. Big Business is one-time, stored as `lifetime`. */
const PLAN_INTERVALS: Record<Exclude<PlanId, 'free'>, readonly BillingInterval[]> = {
  pro: ['monthly', 'annual', 'lifetime'],
  teams: ['monthly', 'annual'],
  enterprise: ['monthly'],
  business: ['lifetime'],
};

export function planSoldOnInterval(plan: Exclude<PlanId, 'free'>, interval: BillingInterval): boolean {
  return PLAN_INTERVALS[plan].includes(interval);
}

/** Reader-facing plan names. */
export const PLAN_NAMES: Record<PlanId, string> = {
  free: 'Free',
  pro: 'Pro',
  teams: 'Teams',
  enterprise: 'Enterprise',
  business: 'Big Business',
};

/** A plan id from storage or the network as a name; an id this build does not know is a paid plan, never Free. */
export function planDisplayName(plan: string): string {
  return Object.hasOwn(PLAN_NAMES, plan) ? PLAN_NAMES[plan as PlanId] : 'Paid plan';
}

/**
 * Teams checkout opens as soon as both Teams Stripe prices exist on the server
 * (STRIPE_PRICE_TEAMS_MONTHLY and STRIPE_PRICE_TEAMS_ANNUAL, $8 and $72 per seat).
 */
export function teamsCheckoutEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.STRIPE_PRICE_TEAMS_MONTHLY?.trim() && env.STRIPE_PRICE_TEAMS_ANNUAL?.trim());
}

/** Founding Teams seat cap. Above this is Enterprise conversation pricing. */
export const TEAMS_MAX_SEATS = 20;

/**
 * A Stripe Checkout session is payable for this long (Stripe allows 30 minutes to 24 hours). The
 * server treats its checkout intent as open a little longer, so it never starts a second session
 * while the first can still be paid.
 */
export const CHECKOUT_SESSION_TTL_MS = 31 * 60_000;
export const CHECKOUT_INTENT_TTL_MS = 32 * 60_000;

/** Published totals in cents. UI copy must stay in lockstep with these numbers. */
const UNIT_CENTS: Record<'free' | 'pro' | 'teams', { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  /** Pro $9/mo · $81/yr (25% off). Stripe price IDs must match. */
  pro: { monthly: 900, annual: 8_100 },
  /** Teams $8/seat/mo · $72/seat/yr (25% off). */
  teams: { monthly: 800, annual: 7_200 },
};

/** Pro Lifetime one-time purchase in cents. */
export const PRO_LIFETIME_CENTS = 8_000;

/** Enterprise $50 a month, one account (no annual price). */
export const ENTERPRISE_MONTHLY_CENTS = 5_000;

/** Big Business $5,000 one-time, one account. */
export const BUSINESS_ONE_TIME_CENTS = 500_000;

export function priceFor(plan: PlanId, interval: 'monthly' | 'annual' | 'lifetime', seats: number): number {
  if (plan === 'free') return 0;
  if (!planSoldOnInterval(plan, interval)) throw new Error(`${PLAN_NAMES[plan]} is not sold ${interval === 'lifetime' ? 'as a one-time purchase' : interval}.`);
  if (plan === 'enterprise') return ENTERPRISE_MONTHLY_CENTS;
  if (plan === 'business') return BUSINESS_ONE_TIME_CENTS;
  if (interval === 'lifetime') return PRO_LIFETIME_CENTS;
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
  if (plan !== 'teams') return 1;
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

/**
 * When paid access on this row came from outside Stripe (a promo code, a gift, a referral or any other
 * complimentary grant) and is still running, the date it ends; otherwise null. Such a row carries no
 * Stripe subscription id. Lifetime is a Stripe purchase and is never complimentary.
 */
export function complimentaryPaidEnd(subscription: SubscriptionRecord, now = new Date()): string | null {
  if (subscription.stripeSubscriptionId || subscription.interval === 'lifetime') return null;
  const { currentPeriodEnd } = subscription;
  if (!currentPeriodEnd || new Date(currentPeriodEnd) <= now) return null;
  const plan = effectivePlan(subscription.plan, subscription.status, subscription.gracePeriodEndsAt, now, currentPeriodEnd);
  return plan === 'free' ? null : currentPeriodEnd;
}

export function monthWindow(now = new Date()): { startsAt: string; resetsAt: string } {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startsAt: startsAt.toISOString(), resetsAt: resetsAt.toISOString() };
}

export function planLimit(plan: PlanId, kind: UsageKind, seats: number): number {
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
