/**
 * Public prices and allowances. Keep in lockstep with web/src/billing/plans.ts (BILLING_LIMITS,
 * UNIT_CENTS) and the Stripe price IDs checkout uses. Every site sentence with one of these
 * numbers is built from here, so a change is one edit.
 */
export const PRICING = {
  proMonthly: 9,
  proAnnual: 81,
  annualDiscountPercent: 25,
  /** Enterprise is monthly only. */
  enterpriseMonthly: 50,
  /** Big Business is one payment, not a subscription. */
  businessOnce: 5000,
} as const;

/** AI explanations a month, per plan (web/src/billing/plans.ts BILLING_LIMITS). */
export const EXPLANATIONS_PER_MONTH = {
  /** Signed-in Free. */
  free: 50,
  pro: 200,
  enterprise: 1000,
} as const;

/** Without an account: explanations in the first 30 days (web/src/lib/trialAccess.ts). */
export const TRIAL_EXPLANATIONS = 50;

/** Big Business: people per purchase, each on a named seat (one named account). */
export const BUSINESS_SEATS = 10;

/**
 * Big Business has no monthly cap. Its only limit is this fair-use rate limit against automated
 * abuse, per person, explanations and questions counted together (web/src/billing/plans.ts).
 */
export const BUSINESS_RATE_LIMIT = { perMinute: 10, perHour: 60, charactersPerHour: 1_000_000 } as const;

/** Big Business only: the one line in the site source with this word. */
export const BUSINESS_UNLIMITED = "unlimited explanations and questions";

/** The rate limit's name. On the Big Business card it links to the fair-use section. */
export const FAIR_USE_LABEL = "fair-use rate limit against automated abuse";

/** The rate limit in words, built from BUSINESS_RATE_LIMIT. */
export const BUSINESS_RATE_LIMIT_LINE = `${FAIR_USE_LABEL}: per person, ${BUSINESS_RATE_LIMIT.perMinute} requests a minute, ${BUSINESS_RATE_LIMIT.perHour} an hour and ${BUSINESS_RATE_LIMIT.charactersPerHour / 1_000_000} million characters an hour`;

/** The fair-use section on /pricing. The rate limit's name on the Big Business card links here. */
export const FAIR_USE_HREF = "/pricing#fair-use";

/** 1000 → "1,000". */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** The settled Free sentence, word for word. */
export const FREE_LINE = `Free: ${EXPLANATIONS_PER_MONTH.free} explanations a month with a free account (${TRIAL_EXPLANATIONS} in your first 30 days without one)`;

export const PRO_MONTHLY_LABEL = `$${PRICING.proMonthly}/month`;
export const PRO_ANNUAL_LABEL = `$${PRICING.proAnnual}/year`;
