/**
 * Plan ids the desktop app knows and how each one reads. The server's billing plans are
 * free, pro, teams, enterprise and business; local, trial and full are this app's own usage modes.
 * A plan id this build doesn't know is a paid plan from a newer server: it reads "Paid plan" and
 * never silently becomes Free.
 */
export type PlanId = 'free' | 'pro' | 'teams' | 'enterprise' | 'business' | 'local' | 'trial' | 'full' | 'paid';

/** The free plan has one name everywhere, "Free": signed in, the public-beta trial, or counted locally. */
const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Free',
  pro: 'Pro',
  teams: 'Teams',
  enterprise: 'Enterprise',
  business: 'Big Business',
  local: 'Free',
  trial: 'Free',
  full: 'Full access',
  paid: 'Paid plan',
};

/**
 * The written fair-use section Big Business points to. Big Business explanations and questions are
 * unlimited; the only usage limit is a fair-use rate limit against automated abuse, never a monthly
 * cap (each request also has the size limit every plan has).
 */
export const FAIR_USE_URL = 'https://unvibe.site/pricing#fair-use';

/** No plan yet (nothing loaded) counts as Free; an id this build doesn't know is a paid plan. */
export function asPlanId(value: string | null | undefined): PlanId {
  if (!value) return 'free';
  return Object.prototype.hasOwnProperty.call(PLAN_LABELS, value) ? (value as PlanId) : 'paid';
}

export function planLabel(plan: string | null | undefined): string {
  return PLAN_LABELS[asPlanId(plan)];
}

/** Every plan that gets the Pro features (git diffs, nearby files, Expert depth). */
export function isProPlan(plan: string | null | undefined): boolean {
  const id = asPlanId(plan);
  return id === 'pro' || id === 'teams' || id === 'enterprise' || id === 'business' || id === 'full';
}

/** A billed plan, including one this build doesn't know. Free, the trial, local counting and full builds are not. */
export function isPaidPlan(plan: string | null | undefined): boolean {
  const id = asPlanId(plan);
  return id === 'pro' || id === 'teams' || id === 'enterprise' || id === 'business' || id === 'paid';
}

/**
 * True when a usage line's allowance is used up. `remaining: null` is an unlimited allowance (no
 * monthly cap), which is never used up: null must never read as 0.
 */
export function allowanceUsedUp(usage: { remaining: number | null }): boolean {
  return usage.remaining !== null && usage.remaining <= 0;
}

/**
 * The panel's message when the explanation allowance is used up and no own API key is set.
 * It never offers an upgrade: the main process doesn't know whether checkout is open, and no tier may read as
 * available to buy until it is. Big Business (and any unlimited line) has no monthly cap to reach, so
 * its message is only the fair-use rate limit against automated abuse.
 */
export function limitReachedMessage(usage: { plan: string; limit: number | null; resetsAt: string }): string {
  const id = asPlanId(usage.plan);
  if (id === 'business' || usage.limit === null) {
    return `Explanations are paused for a moment by the fair-use rate limit against automated abuse. Try again in a few minutes. The fair-use rate limit is at ${FAIR_USE_URL}.`;
  }
  const resets = new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const limit = formatCount(usage.limit);
  if (id === 'trial') {
    return `You have reached your 30-day Free explanation limit (${limit}). Free explanations on this computer end on ${resets}. Sign in to keep going (a new account's first month is Pro), or add your own API key in Settings → AI.`;
  }
  const name = id === 'paid' ? '' : `${planLabel(id)} `;
  return `You have reached your monthly ${name}explanation limit (${limit}). Resets on ${resets}. Add your own API key in Settings → AI to keep going.`;
}

/** Counts as people read them: 5000 → "5,000". Every reader-facing allowance number goes through this. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
