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

/** The written Big Business fair-use limit, a month. The app enforces it like any plan limit. */
export const BUSINESS_FAIR_USE = { explanations: 5000, questions: 10000 } as const;

/** The fair-use section on /pricing. Every "unlimited" on the site links here. */
export const FAIR_USE_HREF = "/pricing#fair-use";

/** 1000 → "1,000". */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** The settled Free sentence, word for word. */
export const FREE_LINE = `Free: ${EXPLANATIONS_PER_MONTH.free} explanations a month with a free account (${TRIAL_EXPLANATIONS} in your first 30 days without one)`;

export const PRO_MONTHLY_LABEL = `$${PRICING.proMonthly}/month`;
export const PRO_ANNUAL_LABEL = `$${PRICING.proAnnual}/year`;
