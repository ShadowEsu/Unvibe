/**
 * Privacy respecting analytics abstraction.
 *
 * Mixpanel loads via mixpanel-browser (autocapture + session replay inside
 * Mixpanel Pro startup credits). We never send code contents, emails, or other
 * personal data: replays mask all text and inputs, and emails, tokens and codes
 * are stripped from every URL before it leaves the page (analyticsPrivacy.ts).
 * An anonymous id is kept in localStorage. Nothing loads or is sent until the
 * visitor presses Allow on the analytics bar (analyticsConsent.ts); Global
 * Privacy Control counts as No thanks. Automated browsers, visitors who opted
 * out with ?notrack=1 (trackingOptOut.ts), and admin, capability and sign-in
 * pages (/activate, /redeem) load no SDK and send nothing either. An SDK that
 * finishes loading after an opt-out or a client navigation into one of those
 * pages waits uninitialised. No thanks or an opt-out after the SDK started,
 * or a client navigation into one of those pages, turns its capture and
 * replay off there (syncSessionRecording).
 */

import { type AnalyticsEvent } from "@/lib/analyticsEvents";
import {
  INITIAL_REPLAY_STATE,
  MIXPANEL_REPLAY_PERCENT,
  analyticsAllowedOnPath,
  initLoadedSdks,
  mixpanelPrivacyConfig,
  sanitizeUrl,
  syncCaptureForPage,
  syncReplayForPage,
  type MixpanelReplay,
  type MixpanelTracking,
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

function usablePublicToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === "[SENSITIVE]" || value.toLowerCase() === "sensitive") return undefined;
  return value;
}

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

export const analyticsEnabled = Boolean(MIXPANEL_BROWSER_TOKEN);

let mixpanelClient: MixpanelClient | null = null;
let mixpanelStart: Promise<void> | null = null;
/** Loaded but not initialised yet, because the load finished after an opt-out or on an admin page. */
let mixpanelLoaded: MixpanelClient | null = null;
const mixpanelQueue: Array<{ event: AnalyticsEvent; props: Props }> = [];

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

/** Track an enumerated event on Mixpanel (the browser SDK, or /api/analytics without a browser token). */
export function track(event: AnalyticsEvent, props?: Props): void {
  if (analyticsOff()) return;
  const cleaned = cleanedProps(props);
  recordFunnelEvent(event);
  sendMixpanel(event, cleaned);
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

/** Load the Mixpanel browser SDK when its token is present. */
export function initAnalytics(): void {
  if (analyticsOff()) return;
  startMixpanel();
}

/**
 * The analytics bar's buttons. Allow loads the SDK. No thanks after an earlier Allow turns its
 * capture and replay off at once (the same opt-out calls `?notrack=1` makes).
 */
export function setAnalyticsConsent(choice: AnalyticsChoice): void {
  storeAnalyticsConsent(choice);
  initAnalytics();
  syncSessionRecording();
}

/**
 * Initialises the SDK once it finished loading and the page allows it, turns its capture off
 * after an opt-out and back on when it is lifted (syncCaptureForPage), then starts and stops
 * session replay for the current page (rules in syncReplayForPage). Call after every navigation,
 * including one that only changes the query; the SDK loader calls it too, and it re-runs itself
 * while a stopped Mixpanel recorder may still come up.
 */
export function syncSessionRecording(): void {
  if (typeof window === "undefined") return;
  const page = { href: window.location.href, trackingDisabled: browserTrackingDisabled() };
  const syncCapture = () => syncCaptureForPage(page, { mixpanel: mixpanelClient });
  ({ mixpanel: mixpanelLoaded } = initLoadedSdks(page, { mixpanel: mixpanelLoaded }, {
    mixpanel: initMixpanel,
    syncCapture,
    flush: flushMixpanel,
  }));
  syncCapture();
  replayState = syncReplayForPage(
    replayState,
    { ...page, mixpanelSampled: mixpanelReplaySampled },
    { mixpanel: mixpanelClient },
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

