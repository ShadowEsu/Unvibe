/**
 * The mode of a Stripe secret (`sk_`) or restricted (`rk_`) key: `test`, `live`, or null for anything
 * else. Anchored and case-sensitive, with no trimming: surrounding whitespace, a newline, an empty or
 * non-alphanumeric suffix, uppercase prefixes, publishable (`pk_`) and organization keys are all
 * null, and a null key is treated as not configured. The only key parser for Stripe mode in this app.
 */
export function stripeKeyMode(key: string | undefined): 'test' | 'live' | null {
  const match = key === undefined ? null : /^(?:sk|rk)_(test|live)_[0-9A-Za-z]+$/.exec(key);
  return match ? (match[1] as 'test' | 'live') : null;
}
