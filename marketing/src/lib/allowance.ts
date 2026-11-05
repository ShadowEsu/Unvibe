/**
 * The explanation allowances, written once for every page that states one (/pricing, /beta, the FAQ,
 * /about, the download email). Numbers as the product enforces them (lead, 31 Oct):
 * - signed out, the app's built-in trial: 50 explanations in the first 30 days (app/src/main/usage.ts
 *   TRIAL_FREE_LIMIT; web trial). Follow-up questions count toward these; the trial also has 50 Test me
 *   questions. Nothing resets for unsigned use.
 * - signed in, Free: 50 explanations a month (web/src/billing/plans.ts free.ai_explanation).
 * - Pro: 200 AI explanations a month (plans.ts pro.ai_explanation; plan_entitlements, applied 2 Nov;
 *   ledger 417). Worded as the Terms say it.
 */
export const ALLOWANCE = {
  trialExplanations: 50,
  trialTestMe: 50,
  trialDays: 30,
  freeMonthly: 50,
  proMonthly: 200,
} as const;

/** Signed out, short form: "50 explanations in your first 30 days without signing in". */
export const SIGNED_OUT_ALLOWANCE = `${ALLOWANCE.trialExplanations} explanations in your first ${ALLOWANCE.trialDays} days without signing in`;

/** Signed out, full form with what counts, for answers that have the room. */
export const TRIAL_ALLOWANCE = `${ALLOWANCE.trialExplanations} explanations (follow-up questions count toward these) and ${ALLOWANCE.trialTestMe} Test me questions in your first ${ALLOWANCE.trialDays} days`;

/** Signed in, Free: "50 explanations a month". */
export const FREE_MONTHLY_ALLOWANCE = `${ALLOWANCE.freeMonthly} explanations a month`;

/** Pro: "200 AI explanations a month", as the Terms word it. */
export const PRO_MONTHLY_ALLOWANCE = `${ALLOWANCE.proMonthly} AI explanations a month`;
