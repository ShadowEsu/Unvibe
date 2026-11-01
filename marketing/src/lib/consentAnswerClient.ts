/**
 * Browser side of the daily count of analytics-bar answers (Security C-1/C-2 in
 * requests/unvibe/20261030-0737-security-consent-answer-count.md). Called only from the bar's Allow and
 * No thanks buttons: one request per press, carrying only the answer, with no cookie and no referrer.
 * Never sent on load, on Escape or close, from the Global Privacy Control bar's OK, or from a browser
 * that opted out (?notrack=1) or is automated, so QA and CI runs stay out of the numbers.
 */
import type { AnalyticsChoice } from "@/lib/analyticsConsent";
import { trackingDisabled, type OptOutStorage } from "@/lib/trackingOptOut";

export const CONSENT_ANSWER_PATH = "/api/consent/answer";

/**
 * True when this browser opted out of analytics (?notrack, automated). This is the opt-out alone, not
 * `browserTrackingDisabled()`, which is also true after No thanks and would drop every "deny".
 */
function optedOut(): boolean {
  let storage: OptOutStorage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return trackingDisabled({
    webdriver: window.navigator?.webdriver === true,
    search: window.location?.search ?? "",
    storage,
  });
}

export function sendConsentAnswer(answer: AnalyticsChoice): void {
  if (typeof window === "undefined" || typeof fetch === "undefined" || optedOut()) return;
  void fetch(CONSENT_ANSWER_PATH, {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answer }),
  }).catch(() => undefined);
}
