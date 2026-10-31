/**
 * The visitor's answer to the analytics bar (AnalyticsConsentBar). Until this browser has
 * answered Allow for the current policy version, no analytics SDK loads and nothing is sent:
 * `browserTrackingDisabled` (trackingOptOut.ts) reads this, and every analytics path checks it.
 * The one exception is the press itself: Allow or No thanks adds one to that day's count of that
 * answer, with no ID (consentAnswerClient.ts).
 *
 * Stored in localStorage as `{"v":"2026-10-28","choice":"allow"|"deny","at":"<ISO time>"}`.
 * A record for another policy version counts as no answer, so the bar asks again. A browser that
 * sends Global Privacy Control is treated as No thanks and is not asked.
 */

export const ANALYTICS_CONSENT_KEY = "unvibe.analyticsConsent";
export const ANALYTICS_POLICY_VERSION = "2026-10-28";
/** Window event after this tab stores an answer. */
export const ANALYTICS_CONSENT_CHANGED = "unvibe:analytics-consent-changed";
/** Window event from the footer's "Analytics settings": shows the bar again. */
export const OPEN_ANALYTICS_SETTINGS = "unvibe:open-analytics-settings";

export type AnalyticsChoice = "allow" | "deny";
/** "ask": no answer for this policy version, so the bar shows and nothing is tracked. */
export type AnalyticsConsent = AnalyticsChoice | "ask";

/** Reads a stored record. Global Privacy Control always means deny. */
export function readAnalyticsConsent(stored: string | null, globalPrivacyControl: boolean): AnalyticsConsent {
  if (globalPrivacyControl) return "deny";
  if (!stored) return "ask";
  try {
    const record: unknown = JSON.parse(stored);
    if (record && typeof record === "object") {
      const { v, choice } = record as { v?: unknown; choice?: unknown };
      if (v === ANALYTICS_POLICY_VERSION && (choice === "allow" || choice === "deny")) return choice;
    }
  } catch {
    // Not JSON: ask again.
  }
  return "ask";
}

/** The record stored for an answer. */
export function analyticsConsentRecord(choice: AnalyticsChoice, at: Date): string {
  return JSON.stringify({ v: ANALYTICS_POLICY_VERSION, choice, at: at.toISOString() });
}

/** An answer given in this tab while storage is blocked; it lasts until the tab closes. */
let unstoredChoice: AnalyticsChoice | null = null;

export function browserGlobalPrivacyControl(): boolean {
  if (typeof window === "undefined") return false;
  return (window.navigator as { globalPrivacyControl?: unknown } | undefined)?.globalPrivacyControl === true;
}

/** The live browser's answer. "ask" on the server. */
export function browserAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "ask";
  const gpc = browserGlobalPrivacyControl();
  try {
    const consent = readAnalyticsConsent(window.localStorage.getItem(ANALYTICS_CONSENT_KEY), gpc);
    if (consent !== "ask" || !unstoredChoice) return consent;
  } catch {
    // Storage blocked: fall through to this tab's answer.
  }
  return gpc ? "deny" : unstoredChoice ?? "ask";
}

/** Stores the answer and tells this tab's listeners. Callers then start or stop the SDKs. */
export function storeAnalyticsConsent(choice: AnalyticsChoice, now = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, analyticsConsentRecord(choice, now));
    unstoredChoice = null;
  } catch {
    unstoredChoice = choice;
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED));
}

/** Shows the analytics bar again (footer "Analytics settings"). */
export function openAnalyticsSettings(): void {
  window.dispatchEvent(new Event(OPEN_ANALYTICS_SETTINGS));
}
