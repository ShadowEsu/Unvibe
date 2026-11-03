/**
 * The mode of a Stripe key this server accepts: `test` for a secret or restricted test key
 * (`sk_test_`, `rk_test_`), `live` for a restricted live key (`rk_live_`) only, or null for anything
 * else. A live secret key (`sk_live_`) is refused (Security L3, 2 Nov: production runs on a restricted
 * key with only the scopes it needs), and so is anything with surrounding whitespace, a newline, an
 * empty or non-alphanumeric suffix, an uppercase prefix, a publishable (`pk_`) or an organization key.
 * Anchored and case-sensitive, with no trimming. A null key is treated as not configured, so no
 * Stripe client is built for it. The only key parser for Stripe mode in this app.
 */
export function stripeKeyMode(key: string | undefined): 'test' | 'live' | null {
  if (key === undefined) return null;
  if (/^(?:sk|rk)_test_[0-9A-Za-z]+$/.test(key)) return 'test';
  if (/^rk_live_[0-9A-Za-z]+$/.test(key)) return 'live';
  return null;
}

/**
 * A webhook signing secret as Stripe issues it (`whsec_` and an alphanumeric suffix), with no trimming.
 * A placeholder or a value stored with a trailing newline is not a secret: the webhook answers 503
 * `webhook_not_configured`, so the unsigned-POST gate after a deploy can see it (Security C1, 26 Oct).
 */
export function webhookSecretValid(secret: string | undefined): boolean {
  return secret !== undefined && /^whsec_[0-9A-Za-z]+$/.test(secret);
}
