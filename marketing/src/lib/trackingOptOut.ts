/**
 * Who should never be counted in site analytics.
 *
 * - Everyone, until they press Allow on the analytics bar (analyticsConsent.ts). Global
 *   Privacy Control counts as No thanks.
 * - Automated browsers (Playwright, Selenium; `navigator.webdriver === true`): our own CI
 *   device test and site sweeps were about a third of tracked visitors in October 2026.
 * - Anyone who opts out: `?notrack=1` on any page stores the choice in this browser,
 *   `?notrack=0` clears it. For Preston's and agents' own devices.
 */

import { browserAnalyticsConsent } from "@/lib/analyticsConsent";

export const NOTRACK_STORAGE_KEY = "unvibe_notrack";

export interface OptOutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface OptOutContext {
  webdriver: boolean;
  /** `location.search`, e.g. "?notrack=1". */
  search: string;
  storage: OptOutStorage | null;
}

/** Applies a `?notrack=` choice, then says whether this visit must not be tracked. */
export function trackingDisabled({ webdriver, search, storage }: OptOutContext): boolean {
  if (webdriver) return true;
  const choice = new URLSearchParams(search).get("notrack");
  try {
    if (choice === "1") storage?.setItem(NOTRACK_STORAGE_KEY, "1");
    else if (choice === "0") storage?.removeItem(NOTRACK_STORAGE_KEY);
    return choice === "1" || storage?.getItem(NOTRACK_STORAGE_KEY) === "1";
  } catch {
    // Storage blocked (private mode, policies): honour the parameter for this page only.
    return choice === "1";
  }
}

/**
 * Reads the live browser: true unless this browser allowed analytics and has not opted out.
 * False on the server, where nothing is sent anyway.
 */
export function browserTrackingDisabled(): boolean {
  if (typeof window === "undefined") return false;
  let storage: OptOutStorage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  // The opt-out runs first so a `?notrack=` choice is stored even before an answer on the bar.
  const optedOut = trackingDisabled({
    webdriver: window.navigator?.webdriver === true,
    search: window.location?.search ?? "",
    storage,
  });
  return optedOut || browserAnalyticsConsent() !== "allow";
}
