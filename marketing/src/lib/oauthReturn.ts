/**
 * Supabase sends a sign-in that did not finish back to the page with `error=` (and `error_code=`,
 * `error_description=`) in the query, the hash, or both: Cancel at Google, access_denied, an expired
 * email link, or any provider error. Pages only ask whether that happened; the provider's text is
 * never shown, so nothing from the address is echoed into the page.
 */
export const SIGN_IN_DID_NOT_FINISH = "Sign-in did not finish.";

const ERROR_KEYS = ["error", "error_code", "error_description"];

export function signInReturnFailed(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  return ERROR_KEYS.some((key) => query.has(key) || fragment.has(key));
}

/** `search` without the error keys (and Supabase's empty `sb` marker), for history.replaceState. */
export function withoutSignInError(search: string): string {
  const query = new URLSearchParams(search);
  for (const key of [...ERROR_KEYS, "sb"]) query.delete(key);
  const rest = query.toString();
  return rest ? `?${rest}` : "";
}
