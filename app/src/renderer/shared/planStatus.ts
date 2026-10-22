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
    ? `Free beta ends on ${shortDate(iso)} (${daysLeft(iso, now)})`
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
