/**
 * The share of the AI allowance used, as the Island's card shows it ("N% AI used"). Worked out from
 * `remaining`, the number "N left" and "N AI" show, so the three always agree and the share stays
 * between 0 and 100: `used` also counts own-key explanations past the limit and an expired trial
 * keeps its old `used` while `remaining` is 0. Undefined without a positive limit.
 */
export function allowanceUsedPct(quota: { limit: number; remaining: number } | undefined): number | undefined {
  if (!quota || !(quota.limit > 0)) return undefined;
  const used = (quota.limit - quota.remaining) / quota.limit;
  return Math.min(100, Math.max(0, Math.round(used * 100)));
}
