/** Browser-side holder for the console admin token (WAITLIST_ADMIN_TOKEN). Session only. */
const KEY = "unvibe.consoleToken";

export function readConsoleToken(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveConsoleToken(token: string): void {
  try {
    if (token) window.sessionStorage.setItem(KEY, token);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the token lives only for this page view.
  }
}

export function consoleHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = readConsoleToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}
