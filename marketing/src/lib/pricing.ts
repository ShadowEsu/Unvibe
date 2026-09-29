/**
 * Public prices, set by the founder on 2026-09-28. Keep in lockstep with
 * web/src/billing/plans.ts and the Stripe price IDs checkout uses.
 */
export const PRICING = {
  proMonthly: 8,
  proAnnual: 72,
  proLifetime: 80,
  teamsSeatMonthly: 8,
  teamsSeatAnnual: 72,
  annualDiscountPercent: 25,
  teamsMinSeats: 2,
  teamsMaxSeats: 20,
} as const;

export const PRO_MONTHLY_LABEL = `$${PRICING.proMonthly}/month`;
export const PRO_ANNUAL_LABEL = `$${PRICING.proAnnual}/year`;
export const TEAMS_SEAT_LABEL = `$${PRICING.teamsSeatMonthly}/seat/month`;
