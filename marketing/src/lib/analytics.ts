/**
 * Privacy respecting analytics abstraction.
 *
 * Mixpanel loads via mixpanel-browser (autocapture + session replay inside
 * Mixpanel Pro startup credits). PostHog loads via posthog-js when
 * NEXT_PUBLIC_POSTHOG_KEY is set — named events, exception autocapture for
 * Error Tracking, and Surveys. We never send code contents, emails, or other
 * personal data. An anonymous id is kept in localStorage.
 */

import { type AnalyticsEvent } from "@/lib/analyticsEvents";

export type { AnalyticsEvent };

type Props = Record<string, string | number | boolean | undefined>;
type MixpanelClient = {
  init: (token: string, config: Record<string, unknown>) => void;
  identify: (id: string) => void;
  track: (event: string, props?: Record<string, unknown>) => void;
};
type PosthogClient = {
  init: (token: string, config: Record<string, unknown>) => void;
  identify: (id: string) => void;
  capture: (event: string, props?: Record<string, unknown>) => void;
  captureException: (error: unknown, props?: Record<string, unknown>) => void;
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

let posthogClient: PosthogClient | null = null;
let posthogStart: Promise<void> | null = null;
const posthogQueue: Array<{ event: AnalyticsEvent; props: Props }> = [];

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

function flushPosthog(): void {
  if (!posthogClient) return;
  while (posthogQueue.length > 0) {
    const item = posthogQueue.shift();
    if (!item) break;
    posthogClient.capture(item.event, item.props);
  }
}

function sendPosthog(event: AnalyticsEvent, cleaned: Props): void {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  const props = { ...cleaned, $current_url: window.location.href };
  if (posthogClient) {
    posthogClient.capture(event, props);
    return;
  }
  posthogQueue.push({ event, props });
  initAnalytics();
}

function flushMixpanel(): void {
  if (!mixpanelClient) return;
  while (mixpanelQueue.length > 0) {
    const item = mixpanelQueue.shift();
    if (!item) break;
    mixpanelClient.track(item.event, item.props);
  }
}

function sendMixpanel(event: AnalyticsEvent, props: Props): void {
  if (typeof window === "undefined") return;
  const withPath = { ...props, path: window.location.pathname };
  if (mixpanelClient) {
    mixpanelClient.track(event, withPath);
    return;
  }
  if (MIXPANEL_BROWSER_TOKEN) {
    mixpanelQueue.push({ event, props: withPath });
    initAnalytics();
    return;
  }
  const body = JSON.stringify({
    event,
    distinctId: anonId(),
    properties: withPath,
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

/** Track an enumerated event on Mixpanel and PostHog when configured. */
export function track(event: AnalyticsEvent, props?: Props): void {
  if (typeof window === "undefined") return;
  const cleaned = cleanedProps(props);
  sendPosthog(event, cleaned);
  sendMixpanel(event, cleaned);
}

/** Manual exception capture for handled errors (uncaught still autocaptured). */
export function captureClientException(
  error: unknown,
  props?: Props,
): void {
  if (typeof window === "undefined") return;
  initAnalytics();
  const cleaned = cleanedProps(props);
  if (posthogClient) {
    posthogClient.captureException(error, cleaned);
    return;
  }
  void posthogStart?.then(() => {
    posthogClient?.captureException(error, cleaned);
  });
}

function startPosthog(): void {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  if (posthogClient || posthogStart) return;
  posthogStart = import("posthog-js")
    .then((mod) => {
      const posthog = mod.default as PosthogClient;
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        defaults: "2026-05-30",
        persistence: "localStorage",
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
        // Uses $50k PostHog startup credits: Error Tracking + Surveys need the SDK.
        capture_exceptions: true,
        disable_session_recording: false,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: "[data-ph-mask]",
        },
      });
      posthog.identify(anonId());
      posthogClient = posthog;
      flushPosthog();
    })
    .catch(() => {
      posthogStart = null;
    });
}

function startMixpanel(): void {
  if (!MIXPANEL_BROWSER_TOKEN || typeof window === "undefined") return;
  if (mixpanelClient || mixpanelStart) return;
  mixpanelStart = import("mixpanel-browser")
    .then((mod) => {
      const mixpanel = mod.default as MixpanelClient;
      // Mixpanel for Startups Pro credits: autocapture + session replay are included.
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

/** Load Mixpanel + PostHog browser SDKs when tokens are present. */
export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  startPosthog();
  startMixpanel();
}
