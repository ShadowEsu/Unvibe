/** Plan-card status copy. Pure so the wording for each billing state is testable. */

export function daysUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysLeft(iso: string, now: number): string {
  const days = daysUntil(iso, now);
  return `${days} day${days === 1 ? '' : 's'} left`;
}

export function resetLabel(iso: string, plan: string, now = Date.now()): string {
  // The public beta is a 30-day window that ends; it does not reset.
  return plan === 'trial'
    ? `Free explanations on this computer end on ${shortDate(iso)} (${daysLeft(iso, now)})`
    : `Usage limits reset on ${shortDate(iso)} (${daysLeft(iso, now)})`;
}

export interface PaidSubscriptionState {
  status: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
}

/**
 * The line a paying user must see instead of the usage reset date: a failed payment
 * (with the one fix) or a cancellation (with the end date). Null when the plan renews normally.
 */
export function paidStatusLine(sub: PaidSubscriptionState, planName: string, now = Date.now()): string | null {
  if (sub.status === 'grace_period') {
    return `Your last payment didn't go through. Update your card in Manage billing to keep ${planName}.`;
  }
  if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd) {
    return `${planName} ends on ${shortDate(sub.currentPeriodEnd)} (${daysLeft(sub.currentPeriodEnd, now)}). Use Manage billing to keep it.`;
  }
  return null;
}

/**
 * The line for Pro granted by a gift or welcome month. Gift rows have no Stripe customer
 * (the caller checks `!hasBillingAccount`), so no Stripe subscription can exist and
 * nothing is charged when the period ends. A missing, invalid or past end date shows no date.
 */
export function giftStatusLine(currentPeriodEnd: string | undefined, now = Date.now()): string {
  const end = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() : Number.NaN;
  if (!currentPeriodEnd || Number.isNaN(end) || end <= now) {
    return 'Pro from a gift. When it ends you move to Free, and nothing is charged.';
  }
  return `Pro from a gift until ${shortDate(currentPeriodEnd)}. Then you move to Free, and nothing is charged.`;
}

/** One usage line, as the app's usage check returns it. */
export interface AllowanceLine {
  plan?: string;
  limit: number;
  remaining: number;
  resetsAt: string;
}

/**
 * When a used-up allowance comes back: `resetsAt` as a date in the user's locale, never a
 * countdown. Null for the public-beta trial, whose `resetsAt` is the end of its 30 days (it never
 * refills), and for an unusable date.
 */
export function refillDate(plan: string | undefined, resetsAt: string): string | null {
  const at = new Date(resetsAt);
  if (plan === 'trial' || Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

/** While Pro is closed: Pro isn't open yet, and the Free plan keeps working with its real allowance. */
export function freePlanLine(usage: AllowanceLine | null, now = Date.now()): string {
  if (!usage || usage.limit <= 0) return "Pro isn't open yet. Your Free plan keeps working.";
  const left = `${usage.remaining} of ${usage.limit} explanations left`;
  const refill = refillDate(usage.plan, usage.resetsAt);
  if (refill) return `Pro isn't open yet. Your Free plan keeps working: ${left}, refilling on ${refill}.`;
  const end = new Date(usage.resetsAt).getTime();
  if (usage.plan === 'trial' && end > now) {
    return `Pro isn't open yet. The free explanations on this computer: ${left} until ${shortDate(usage.resetsAt)}. They don't refill; sign in to keep going on the Free plan, which refills every month.`;
  }
  if (usage.plan === 'trial' && !Number.isNaN(end)) {
    return `Pro isn't open yet. The free explanations on this computer ended on ${shortDate(usage.resetsAt)}. Sign in to keep going on the Free plan, which refills every month.`;
  }
  return `Pro isn't open yet. Your Free plan keeps working: ${left}.`;
}

/**
 * The Pro card on Plan. Open: the price and Stripe renewal terms for `interval`. Closed (checkout
 * not open, or its status unknown): no price, interval or checkout, only `freePlanLine`.
 */
export type ProCard =
  | { open: true; price: string; terms: string }
  | { open: false; line: string };

export function proCard(proOpen: boolean, interval: 'monthly' | 'annual', usage: AllowanceLine | null, now = Date.now()): ProCard {
  if (!proOpen) return { open: false, line: freePlanLine(usage, now) };
  return interval === 'annual'
    ? { open: true, price: '$81/yr', terms: 'Pro renews at $81 per year until canceled.' }
    : { open: true, price: '$9/mo', terms: 'Pro renews at $9 per month until canceled.' };
}
