/**
 * Privacy respecting analytics abstraction.
 *
 * Mixpanel loads via mixpanel-browser with the project token. Autocapture
 * and session replay are on so Mixpanel can verify the project. We also
 * track enumerated events. We never send code contents, emails, or other
 * personal data. An anonymous id is kept in localStorage so repeat events
 * from the same browser can be de-duplicated.
 *
 * PostHog still fires from the browser when NEXT_PUBLIC_POSTHOG_KEY is set.
 */

import { type AnalyticsEvent } from "@/lib/analyticsEvents";

export type { AnalyticsEvent };

type Props = Record<string, string | number | boolean | undefined>;
type MixpanelClient = {
  init: (token: string, config: Record<string, unknown>) => void;
  identify: (id: string) => void;
  track: (event: string, props?: Record<string, unknown>) => void;
};

const POSTHOG_KEY =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_POSTHOG_KEY
    : undefined;

const POSTHOG_HOST =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_HOST) ||
  "https://us.i.posthog.com";

const MIXPANEL_BROWSER_TOKEN =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_MIXPANEL_TOKEN
    : undefined;

const ANON_KEY = "unvibe_anon_id";

export const analyticsEnabled = Boolean(POSTHOG_KEY || MIXPANEL_BROWSER_TOKEN);

let mixpanelClient: MixpanelClient | null = null;
let mixpanelStart: Promise<void> | null = null;
const mixpanelQueue: Array<{ event: AnalyticsEvent; props: Props }> = [];

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

function cleanedProps(props?: Props): Props {
  const cleaned: Props = {};
  if (!props) return cleaned;
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) cleaned[k] = v;
  }
  return cleaned;
}

function sendPosthog(event: AnalyticsEvent, cleaned: Props): void {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
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
    // Ignore, best effort only.
  }
}

function flushMixpanel(): void {
  if (!mixpanelClient) return;
  while (mixpanelQueue.length > 0) {
    const item = mixpanelQueue.shift();
    if (!item) break;
    mixpanelClient.track(item.event, item.props);
  }
}

function sendMixpanel(event: AnalyticsEvent, cleaned: Props): void {
  if (typeof window === "undefined") return;
  const props = { ...cleaned, path: window.location.pathname };
  if (mixpanelClient) {
    mixpanelClient.track(event, props);
    return;
  }
  if (MIXPANEL_BROWSER_TOKEN) {
    mixpanelQueue.push({ event, props });
    initAnalytics();
    return;
  }
  const body = JSON.stringify({
    event,
    distinctId: anonId(),
    properties: props,
  });
  try {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Analytics must never break the page.
    });
  } catch {
    // Ignore, best effort only.
  }
}

/** Count copy and survey clicks in founder stats. Best effort only. */
export function recordBetaSiteEvent(event: "copied" | "survey"): void {
  if (typeof window === "undefined") return;
  void fetch("/api/install/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Track an enumerated event. Mixpanel uses the browser SDK when a token is set. */
export function track(event: AnalyticsEvent, props?: Props): void {
  if (typeof window === "undefined") return;
  const cleaned = cleanedProps(props);
  sendPosthog(event, cleaned);
  sendMixpanel(event, cleaned);
}

/** Load Mixpanel with autocapture and session replay, plus named events. */
export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  if (!MIXPANEL_BROWSER_TOKEN) return;
  if (mixpanelClient || mixpanelStart) return;
  mixpanelStart = import("mixpanel-browser")
    .then((mod) => {
      const mixpanel = mod.default as MixpanelClient;
      // Mixpanel for Startups Pro credits: autocapture + session replay are included.
      // Do not enable paid add-ons outside that credit plan.
      mixpanel.init(MIXPANEL_BROWSER_TOKEN, {
        autocapture: true,
        record_sessions_percent: 100,
        persistence: "localStorage",
        track_pageview: true,
        ip: true,
      });
      mixpanel.identify(anonId());
      mixpanelClient = mixpanel;
      flushMixpanel();
    })
    .catch(() => {
      mixpanelStart = null;
    });
}
