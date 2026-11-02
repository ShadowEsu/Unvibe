/** Plans that include Pro features (diff and brief reviews, Expert depth, nearby files). */
export function isProPlan(plan: string): boolean {
  return plan === 'pro' || plan === 'teams' || plan === 'full';
}
