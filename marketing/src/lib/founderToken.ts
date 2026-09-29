/** Browser-side holder for the founder admin token (WAITLIST_ADMIN_TOKEN). Session only. */
const KEY = "unvibe.founderToken";

export function readFounderToken(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveFounderToken(token: string): void {
  try {
    if (token) window.sessionStorage.setItem(KEY, token);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the token lives only for this page view.
  }
}

export function founderHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = readFounderToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}
