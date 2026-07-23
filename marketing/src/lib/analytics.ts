/**
 * Privacy respecting analytics abstraction.
 *
 * If NEXT_PUBLIC_POSTHOG_KEY is not set, every call is a no-op (dev + privacy default).
 * When a key exists we send a minimal, enumerated event to PostHog's HTTP capture
 * endpoint via fetch — no third party script is injected, no cookies are set, and we
 * never send code contents or personal data. An anonymous id is kept in localStorage
 * only so repeat events from the same browser can be de-duplicated.
 */

export type AnalyticsEvent =
  | "waitlist_started"
  | "waitlist_completed"
  | "demo_started"
  | "demo_completed"
  | "depth_changed"
  | "code_example_selected"
  | "faq_opened"
  | "referral_copied"
  | "outbound_social_clicked"
  | "privacy_opened"
  | "pricing_viewed"
  | "billing_interval_selected"
  | "plan_cta_clicked"
  | "release_download_clicked";

type Props = Record<string, string | number | boolean | undefined>;

const POSTHOG_KEY =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_POSTHOG_KEY
    : undefined;

const POSTHOG_HOST =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_HOST) ||
  "https://us.i.posthog.com";

const ANON_KEY = "unvibe_anon_id";

export const analyticsEnabled = Boolean(POSTHOG_KEY);

function anonId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/** Track an enumerated event. No-op unless a PostHog key is configured. */
export function track(event: AnalyticsEvent, props?: Props): void {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  const cleaned: Props = {};
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v !== undefined) cleaned[k] = v;
    }
  }
  const body = JSON.stringify({
    api_key: POSTHOG_KEY,
    event,
    distinct_id: anonId(),
    properties: { ...cleaned, $current_url: window.location.href },
    timestamp: new Date().toISOString(),
  });
  try {
    void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Analytics must never break the page.
    });
  } catch {
    // Ignore — best effort only.
  }
}

/** Reserved for future warm-up; kept for a stable import surface. */
export function initAnalytics(): void {
  // No client to preload — capture happens on demand via fetch.
}
