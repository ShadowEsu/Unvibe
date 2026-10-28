/**
 * Privacy respecting analytics abstraction.
 *
 * Mixpanel loads via mixpanel-browser (autocapture + session replay inside
 * Mixpanel Pro startup credits). PostHog loads via posthog-js when
 * NEXT_PUBLIC_POSTHOG_KEY is set — named events, exception autocapture for
 * Error Tracking, and Surveys. We never send code contents, emails, or other
 * personal data: replays mask all text and inputs, and emails, tokens and codes
 * are stripped from every URL before it leaves the page (analyticsPrivacy.ts).
 * An anonymous id is kept in localStorage. Nothing loads or is sent until the
 * visitor presses Allow on the analytics bar (analyticsConsent.ts); Global
 * Privacy Control counts as No thanks. Automated browsers, visitors who opted
 * out with ?notrack=1 (trackingOptOut.ts), and admin, capability and sign-in
 * pages (/activate, /redeem) load no SDK and send nothing either. An SDK that
 * finishes loading after an opt-out or a client navigation into one of those
 * pages waits uninitialised. No thanks or an opt-out after the SDKs started,
 * or a client navigation into one of those pages, turns their capture and
 * replay off there (syncSessionRecording).
 */

import { type AnalyticsEvent } from "@/lib/analyticsEvents";
import {
  INITIAL_REPLAY_STATE,
  MIXPANEL_REPLAY_PERCENT,
  POSTHOG_PRIVACY_CONFIG,
  analyticsAllowedOnPath,
  initLoadedSdks,
  mixpanelPrivacyConfig,
  sanitizeUrl,
  syncCaptureForPage,
  syncReplayForPage,
  type MixpanelReplay,
  type MixpanelTracking,
  type PosthogCapture,
  type PosthogReplay,
  type ReplayState,
} from "@/lib/analyticsPrivacy";
import { storeAnalyticsConsent, type AnalyticsChoice } from "@/lib/analyticsConsent";
import { browserTrackingDisabled } from "@/lib/trackingOptOut";

export type { AnalyticsEvent };

type Props = Record<string, string | number | boolean | undefined>;
type MixpanelClient = MixpanelReplay & MixpanelTracking & {
  init: (token: string, config: Record<string, unknown>) => void;
  register: (props: Record<string, unknown>) => void;
  track: (event: string, props?: Record<string, unknown>) => void;
};
type PosthogClient = PosthogReplay & PosthogCapture & {
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
/** Loaded but not initialised yet, because the load finished after an opt-out or on an admin page. */
let mixpanelLoaded: MixpanelClient | null = null;
const mixpanelQueue: Array<{ event: AnalyticsEvent; props: Props }> = [];

let posthogClient: PosthogClient | null = null;
let posthogStart: Promise<void> | null = null;
/** Loaded but not initialised yet, because the load finished after an opt-out or on an admin page. */
let posthogLoaded: PosthogClient | null = null;
const posthogQueue: Array<{ event: AnalyticsEvent; props: Props }> = [];

let replayState: ReplayState = INITIAL_REPLAY_STATE;
/** One sampling roll per page load for the Mixpanel replay. */
const mixpanelReplaySampled = Math.random() * 100 < MIXPANEL_REPLAY_PERCENT;
/** Re-checks every 100 ms, for up to 5 s, while a stopped Mixpanel recorder may still come up. */
const REPLAY_RECHECK_MS = 100;
const REPLAY_RECHECK_LIMIT = 50;
let replayRecheckScheduled = false;
let replayRechecks = 0;

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

/**
 * Nothing is sent on the server, before the visitor allows analytics, for opted-out or automated
 * browsers, or on admin and capability pages.
 */
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
      posthogLoaded = mod.default as PosthogClient;
      syncSessionRecording();
    })
    .catch(() => {
      posthogStart = null;
    });
}

/**
 * Exported for tests (the token argument too), which check the config `posthog.init` receives.
 *
 * Ops: PostHog's project-level console log capture (project settings, not this config) must stay
 * off. When on, the SDK sends each log with the raw page address (`location.href`) and no hook
 * (`posthog-js` `posthog-logs.js`, the log context's `currentUrl`), so email-link tokens and
 * codes would go out unsanitized.
 */
export function initPosthog(posthog: PosthogClient, token = POSTHOG_KEY): void {
  if (!token) return;
  posthog.init(token, {
    api_host: POSTHOG_HOST,
    defaults: "2026-05-30",
    persistence: "localStorage",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    // Uses PostHog startup credits: Error Tracking + Surveys need the SDK.
    capture_exceptions: true,
    disable_session_recording: false,
    disable_surveys: false,
    enable_heatmaps: true,
    capture_dead_clicks: true,
    ...POSTHOG_PRIVACY_CONFIG,
  });
  posthog.identify(anonId());
  posthogClient = posthog;
}

function startMixpanel(): void {
  if (!MIXPANEL_BROWSER_TOKEN || typeof window === "undefined") return;
  if (mixpanelClient || mixpanelStart) return;
  mixpanelStart = import("mixpanel-browser")
    .then((mod) => {
      mixpanelLoaded = mod.default as MixpanelClient;
      syncSessionRecording();
    })
    .catch(() => {
      mixpanelStart = null;
    });
}

/**
 * Exported for tests (the token argument too). The distinct id is set as a super property, not
 * with `identify`: Mixpanel sends `identify`'s `$identify` event, and the profile updates it
 * flushes, without `before_send_events`, so the landing URL (an email link's address and token,
 * an invite code) would go out unsanitized.
 */
export function initMixpanel(mixpanel: MixpanelClient, token = MIXPANEL_BROWSER_TOKEN): void {
  if (!token) return;
  removeStoredMixpanelBatches();
  // Mixpanel for Startups Pro credits: autocapture + session replay are included.
  mixpanel.init(token, {
    ...mixpanelPrivacyConfig(),
    persistence: "localStorage",
    track_pageview: true,
    ip: true,
  });
  mixpanel.register({ distinct_id: anonId() });
  mixpanelClient = mixpanel;
}

/**
 * Mixpanel's batch queues (`__mpq_<token>_ev`, `_pp`, `_gr`) from visits made while batching was
 * on. Batching is off and never reads them, but they hold events stored before any hook ran, so
 * they are removed in case batching is ever turned back on.
 */
function removeStoredMixpanelBatches(): void {
  try {
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith("__mpq_")) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage blocked: nothing was stored either.
  }
}

/** Load Mixpanel + PostHog browser SDKs when tokens are present. */
export function initAnalytics(): void {
  if (analyticsOff()) return;
  startPosthog();
  startMixpanel();
}

/**
 * The analytics bar's buttons. Allow loads the SDKs. No thanks after an earlier Allow turns both
 * SDKs' capture and replay off at once (the same opt-out calls `?notrack=1` makes).
 */
export function setAnalyticsConsent(choice: AnalyticsChoice): void {
  storeAnalyticsConsent(choice);
  initAnalytics();
  syncSessionRecording();
}

/**
 * Initialises an SDK that finished loading once the page allows it, turns both SDKs' capture off
 * after an opt-out and back on when it is lifted (syncCaptureForPage), then starts and stops
 * session replay for the current page (rules in syncReplayForPage). Call after every navigation,
 * including one that only changes the query; the SDK loaders call it too, and it re-runs itself
 * while a stopped Mixpanel recorder may still come up.
 */
export function syncSessionRecording(): void {
  if (typeof window === "undefined") return;
  const page = { href: window.location.href, trackingDisabled: browserTrackingDisabled() };
  const syncCapture = () => syncCaptureForPage(page, { posthog: posthogClient, mixpanel: mixpanelClient });
  ({ posthog: posthogLoaded, mixpanel: mixpanelLoaded } = initLoadedSdks(
    page,
    { posthog: posthogLoaded, mixpanel: mixpanelLoaded },
    {
      posthog: initPosthog,
      mixpanel: initMixpanel,
      syncCapture,
      flush: () => {
        flushPosthog();
        flushMixpanel();
      },
    },
  ));
  syncCapture();
  replayState = syncReplayForPage(
    replayState,
    { ...page, mixpanelSampled: mixpanelReplaySampled },
    { posthog: posthogClient, mixpanel: mixpanelClient },
  );
  if (!replayState.mixpanelStopPending) {
    replayRechecks = 0;
  } else if (!replayRecheckScheduled && replayRechecks < REPLAY_RECHECK_LIMIT) {
    replayRechecks += 1;
    replayRecheckScheduled = true;
    setTimeout(() => {
      replayRecheckScheduled = false;
      syncSessionRecording();
    }, REPLAY_RECHECK_MS);
  }
}
