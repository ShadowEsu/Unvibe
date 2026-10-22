/**
 * Privacy respecting analytics abstraction.
 *
 * Mixpanel loads via mixpanel-browser (autocapture + session replay inside
 * Mixpanel Pro startup credits). PostHog loads via posthog-js when
 * NEXT_PUBLIC_POSTHOG_KEY is set — named events, exception autocapture for
 * Error Tracking, and Surveys. We never send code contents, emails, or other
 * personal data: replays mask all text and inputs, and emails, tokens and codes
 * are stripped from every URL before it leaves the page (analyticsPrivacy.ts).
 * An anonymous id is kept in localStorage. Automated browsers, visitors who
 * opted out with ?notrack=1 (trackingOptOut.ts), and admin or capability pages
 * load no SDK and send nothing. Reaching an admin page by client navigation
 * stops replay there (syncSessionRecording).
 */

import { type AnalyticsEvent } from "@/lib/analyticsEvents";
import {
  NO_PAUSED_REPLAYS,
  POSTHOG_PRIVACY_CONFIG,
  analyticsAllowedOnPath,
  mixpanelPrivacyConfig,
  sanitizeUrl,
  syncReplayForPage,
  type MixpanelReplay,
  type PausedReplays,
  type PosthogReplay,
} from "@/lib/analyticsPrivacy";
import { browserTrackingDisabled } from "@/lib/trackingOptOut";

export type { AnalyticsEvent };

type Props = Record<string, string | number | boolean | undefined>;
type MixpanelClient = MixpanelReplay & {
  init: (token: string, config: Record<string, unknown>) => void;
  identify: (id: string) => void;
  track: (event: string, props?: Record<string, unknown>) => void;
};
type PosthogClient = PosthogReplay & {
  init: (token: string, config: Record<string, unknown>) => void;
  identify: (id: string) => void;
  capture: (event: string, props?: Record<string, unknown>) => void;
  captureException: (error: unknown, props?: Record<string, unknown>) => void;
};

const POSTHOG_KEY_RAW =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
    : undefined;

const POSTHOG_HOST_RAW =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim()) ||
  "https://us.i.posthog.com";

function usablePublicToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === "[SENSITIVE]" || value.toLowerCase() === "sensitive") return undefined;
  return value;
}

function usableApiHost(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "https://us.i.posthog.com";
    return url.origin;
  } catch {
    return "https://us.i.posthog.com";
  }
}

const POSTHOG_KEY = usablePublicToken(POSTHOG_KEY_RAW);
const POSTHOG_HOST = usableApiHost(POSTHOG_HOST_RAW);

const MIXPANEL_BROWSER_TOKEN = usablePublicToken(
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim()
    : undefined,
);

const ANON_KEY = "unvibe_anon_id";

const FUNNEL_EVENTS: ReadonlySet<string> = new Set([
  "waitlist_started",
  "waitlist_completed",
  "beta_install_viewed",
  "beta_install_copied",
  "survey_opened",
]);

export const analyticsEnabled = Boolean(POSTHOG_KEY || MIXPANEL_BROWSER_TOKEN);

let mixpanelClient: MixpanelClient | null = null;
let mixpanelStart: Promise<void> | null = null;
const mixpanelQueue: Array<{ event: AnalyticsEvent; props: Props }> = [];

let posthogClient: PosthogClient | null = null;
let posthogStart: Promise<void> | null = null;
const posthogQueue: Array<{ event: AnalyticsEvent; props: Props }> = [];

let pausedReplays: PausedReplays = NO_PAUSED_REPLAYS;

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
  const props = { ...cleaned, $current_url: sanitizeUrl(window.location.href) };
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
  const withPath = { ...props, path: sanitizeUrl(window.location.pathname) };
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
  if (typeof window === "undefined" || browserTrackingDisabled()) return;
  void fetch("/api/install/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => undefined);
}

function recordFunnelEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  if (!FUNNEL_EVENTS.has(event)) return;
  void fetch("/api/funnel/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, distinctId: anonId() }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Nothing is sent on the server, for opted-out or automated browsers, or on admin and capability pages. */
function analyticsOff(): boolean {
  return typeof window === "undefined" || browserTrackingDisabled() || !analyticsAllowedOnPath(window.location.pathname);
}

/** Track an enumerated event on Mixpanel and PostHog when configured. */
export function track(event: AnalyticsEvent, props?: Props): void {
  if (analyticsOff()) return;
  const cleaned = cleanedProps(props);
  recordFunnelEvent(event);
  sendPosthog(event, cleaned);
  sendMixpanel(event, cleaned);
}

/** Manual exception capture for handled errors (uncaught still autocaptured). */
export function captureClientException(
  error: unknown,
  props?: Props,
): void {
  if (analyticsOff()) return;
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
        disable_surveys: false,
        enable_heatmaps: true,
        capture_dead_clicks: true,
        ...POSTHOG_PRIVACY_CONFIG,
      });
      posthog.identify(anonId());
      posthogClient = posthog;
      flushPosthog();
      syncSessionRecording();
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
        ...mixpanelPrivacyConfig(window.location.href),
        persistence: "localStorage",
        track_pageview: true,
        ip: true,
      });
      mixpanel.identify(anonId());
      mixpanelClient = mixpanel;
      flushMixpanel();
      syncSessionRecording();
    })
    .catch(() => {
      mixpanelStart = null;
    });
}

/** Load Mixpanel + PostHog browser SDKs when tokens are present. */
export function initAnalytics(): void {
  if (analyticsOff()) return;
  startPosthog();
  startMixpanel();
}

/**
 * Stops session replay when a client navigation lands on an admin or capability page, and
 * resumes it on leaving (rules in syncReplayForPage). Call after every navigation.
 */
export function syncSessionRecording(): void {
  if (typeof window === "undefined") return;
  pausedReplays = syncReplayForPage(
    pausedReplays,
    { href: window.location.href, trackingDisabled: browserTrackingDisabled() },
    { posthog: posthogClient, mixpanel: mixpanelClient },
  );
}
