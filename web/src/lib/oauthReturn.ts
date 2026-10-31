/**
 * Supabase sends a sign-in that did not finish back to the page with `error=` (and `error_code=`,
 * `error_description=`) in the query, the hash, or both: Cancel at Google, access_denied, an expired
 * email link, or any provider error. The page only asks whether that happened; the provider's text is
 * never shown, so nothing from the address is echoed into the page. Same rule as the site's
 * marketing/src/lib/oauthReturn.ts.
 */
export const SIGN_IN_DID_NOT_FINISH = 'Sign-in did not finish.';

const ERROR_KEYS = ['error', 'error_code', 'error_description'];

export function signInReturnFailed(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return ERROR_KEYS.some((key) => query.has(key) || fragment.has(key));
}
