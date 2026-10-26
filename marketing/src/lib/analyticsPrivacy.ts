/**
 * What the site's analytics SDKs may see.
 *
 * - URLs: email links carry the reader's email and a signed token (`/?feedback=1&e=…&t=…`,
 *   `/api/unsubscribe?e=…&t=…`), invite and gift links carry a code (`?ref=`), device sign-in
 *   carries the device code (`/activate?user_code=…`) and the OAuth code (`?code=`), a promo link
 *   carries its code (`/redeem?promo=…`), and
 *   `/s/<key>` is itself a capability. These values are replaced with "redacted" in every URL
 *   property PostHog or Mixpanel sends, and in the URLs inside PostHog replays.
 * - Replays: all page text and every input is masked, so names, emails on admin pages and model
 *   explanations of someone's code never reach a replay. New elements are covered by default.
 * - Autocapture: no element text and no element attributes.
 * - Admin and capability pages (`/founder`, `/waitlist`, `/waitlist-admin`, `/s/…`) and the pages
 *   that hold a sign-in session (`/activate`, `/redeem`) load no SDK. When a visitor reaches one
 *   by client navigation from a public page, both SDKs' capture and replays stop until they leave
 *   it, and every SDK event recorded there is dropped before sending.
 * - Opt-out (`?notrack=1`, trackingOptOut.ts): both hooks check it again on every event, so an
 *   opt-out after the SDKs started drops what they would send next, and `syncCaptureForPage`
 *   turns both SDKs' own capture off, which also stops their replays.
 */

import type { BeforeSendFn, CaptureResult } from "posthog-js";
import { browserTrackingDisabled } from "@/lib/trackingOptOut";

export const REDACTED = "redacted";

/** Query keys whose values identify a person or work as a credential. Compared lower case. */
const SECRET_PARAMS: Record<string, true> = {
  e: true,
  email: true,
  t: true,
  token: true,
  ref: true,
  code: true,
  promo: true,
  user_code: true,
  device: true,
  device_code: true,
  key: true,
  sig: true,
  signature: true,
  access_token: true,
  refresh_token: true,
  id_token: true,
  state: true,
};

/** Property names that hold a URL or part of one (PostHog `$current_url`, Mixpanel `current_url_search`, …). */
const URL_PROPERTY = /(url|referrer|href|pathname|path|search)$/i;

/** Pages that render private data, whose URL is a secret, or that hold a sign-in session. No analytics SDK starts on them. */
const PRIVATE_PATH = /^\/(founder|waitlist|waitlist-admin|s|activate|redeem)(\/|$)/;

function cleanSearch(search: string): string {
  if (!search || search === "?") return search;
  const params = new URLSearchParams(search);
  const cleaned = new URLSearchParams();
  let changed = false;
  params.forEach((value, name) => {
    const secret = SECRET_PARAMS[name.toLowerCase()] === true || value.includes("@");
    if (secret && value !== REDACTED) changed = true;
    cleaned.append(name, secret ? REDACTED : value);
  });
  return changed ? `?${cleaned.toString()}` : search;
}

/**
 * Returns `value` with emails, tokens and codes replaced by "redacted". Handles absolute URLs,
 * site paths and bare query strings. Anything else (PostHog's `$direct`, a domain) is returned
 * unchanged unless it contains an email.
 */
export function sanitizeUrl(value: string): string {
  if (!value) return value;
  if (value.startsWith("?")) return cleanSearch(value);
  const sitePath = value.startsWith("/") && !value.startsWith("//");
  if (!sitePath && !/^https?:\/\//i.test(value)) return value.includes("@") ? REDACTED : value;
  let url: URL;
  try {
    url = new URL(value, "https://unvibe.site");
  } catch {
    return REDACTED;
  }
  const path = url.pathname.replace(/^\/s\/[^/]+/, `/s/${REDACTED}`);
  const search = cleanSearch(url.search);
  // Plain anchors (`#install`) stay; anything else in a fragment (OAuth tokens, `a=b`) is dropped.
  const hash = /^#?[\w-]*$/.test(url.hash) ? url.hash : "";
  if (path === url.pathname && search === url.search && hash === url.hash && !url.username && !url.password) {
    return value;
  }
  return `${sitePath ? "" : url.origin}${path}${search}${hash}`;
}

type PropertyBag = Record<string, unknown>;

function isPlainObject(value: unknown): value is PropertyBag {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Copies `props`, sanitizing every URL-like string property, including inside `$set`/`$set_once`. */
export function sanitizeProperties<T extends PropertyBag>(props: T): T {
  const out: PropertyBag = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && URL_PROPERTY.test(key)) out[key] = sanitizeUrl(value);
    else if (isPlainObject(value) && (key === "$set" || key === "$set_once")) out[key] = sanitizeProperties(value);
    else out[key] = value;
  }
  return out as T;
}

/** Path of a page URL (absolute or site path); "" when it cannot be parsed. */
function pagePath(href: string): string {
  try {
    return new URL(href, "https://unvibe.site").pathname;
  } catch {
    return "";
  }
}

/** True for an SDK event recorded on an admin or capability page. Both SDKs set `$current_url` on every event. */
function sentFromPrivatePage(properties: PropertyBag | undefined): boolean {
  const url = properties?.$current_url;
  return typeof url === "string" && !analyticsAllowedOnPath(pagePath(url));
}

/**
 * True while this tab shows an admin, capability or sign-in page. The SDKs' opt-in lives in
 * storage shared by every tab, so a tab on a public page can turn capture back on for a tab that
 * sits on `/activate`; this check, made when each event is sent, keeps that tab silent.
 */
function onPrivatePageNow(): boolean {
  return typeof window !== "undefined" && !analyticsAllowedOnPath(window.location?.pathname ?? "/");
}

/**
 * PostHog heatmaps buffer clicks and mouse moves under the raw page URL whatever the capture
 * state, and flush them every few seconds as one `$$heatmap` event from whatever page is open
 * then. So a flush from a public page can carry the last moments on an admin or sign-in page,
 * and URLs with codes. Keeps only public-page keys, sanitized (keys that sanitize alike are
 * merged); null when none is left.
 */
function cleanHeatmapData(data: unknown): Record<string, unknown[]> | null {
  if (!isPlainObject(data)) return null;
  const out: Record<string, unknown[]> = {};
  let kept = false;
  for (const [url, points] of Object.entries(data)) {
    if (!analyticsAllowedOnPath(pagePath(url)) || !Array.isArray(points)) continue;
    const key = sanitizeUrl(url);
    out[key] = [...(out[key] ?? []), ...points];
    kept = true;
  }
  return kept ? out : null;
}

/** PostHog `before_send`: every event, pageview, person update, heatmap flush and replay snapshot. */
export const posthogBeforeSend: BeforeSendFn = (event: CaptureResult | null) => {
  if (!event) return event;
  // This tab is on a private page, whatever another tab did to the shared opt-in.
  if (onPrivatePageNow()) return null;
  // An opt-out after the SDK started.
  if (browserTrackingDisabled()) return null;
  // Pageviews, autocapture, heatmaps and exceptions after a client navigation into an admin page.
  if (sentFromPrivatePage(event.properties)) return null;
  const properties = sanitizeProperties(event.properties);
  if (event.event === "$$heatmap") {
    const heatmapData = cleanHeatmapData(properties.$heatmap_data);
    if (!heatmapData) return null;
    properties.$heatmap_data = heatmapData;
  }
  return {
    ...event,
    properties,
    ...(event.$set ? { $set: sanitizeProperties(event.$set) } : {}),
    ...(event.$set_once ? { $set_once: sanitizeProperties(event.$set_once) } : {}),
  };
};

type NetworkEntry = {
  name: string;
  requestHeaders?: unknown;
  requestBody?: string | null;
  responseHeaders?: unknown;
  responseBody?: string | null;
};

/**
 * PostHog replay: page URLs in the recording and any captured network request. URLs are
 * sanitized; headers (bearer tokens) and bodies (emails, code, explanations) are never kept.
 */
export function maskReplayNetworkEntry<T extends NetworkEntry>(entry: T): T {
  const { requestHeaders: _rh, requestBody: _rb, responseHeaders: _sh, responseBody: _sb, ...rest } = entry;
  return { ...rest, name: sanitizeUrl(entry.name) } as T;
}

/** Mixpanel `before_send_events`: every tracked, autocaptured and pageview event (not replays). Null drops it. */
export function mixpanelBeforeSend<T extends { properties: PropertyBag }>(payload: T): T | null {
  if (onPrivatePageNow() || browserTrackingDisabled() || sentFromPrivatePage(payload.properties)) return null;
  return { ...payload, properties: sanitizeProperties(payload.properties) };
}

/** False on admin, capability and sign-in pages, where no analytics SDK may start. */
export function analyticsAllowedOnPath(pathname: string): boolean {
  return !PRIVATE_PATH.test(pathname);
}

/**
 * Elements with this class are left out of every replay (both SDKs record a blank box instead).
 * Admin, capability and sign-in pages wrap their content in it: a client navigation renders the new page
 * before `syncReplayForPage` stops the replay, and the frames of that moment show no content.
 */
export const REPLAY_BLOCK_CLASS = "ph-no-capture";

/**
 * posthog-js init options (besides the host and project defaults). `maskTextSelector: "*"`
 * masks the text of every element, present or future; inputs are masked too.
 *
 * `request_batching: false`: PostHog's batch queue sends what it holds up to 3 s later and has
 * no way to empty it, so after an opt-out or a client navigation into an admin or sign-in page
 * it still sent events and replay frames captured just before (seen in a real browser). Unbatched,
 * each event leaves when it is captured, so only a failed send that PostHog retries can go out later.
 *
 * `mask_personal_data_properties` with our secret parameters: PostHog masks them itself wherever
 * it reads the address (the stored first landing URL, event URLs, heatmap keys). It also masks ad
 * click ids (gclid, fbclid and others).
 *
 * `advanced_disable_feature_flags: true`: no `/flags` request at all. Its body carries the stored
 * first landing URL and referrer (`$initial_current_url`, `$initial_referrer`) with no hook, and a
 * browser that first landed under an older deploy keeps an unmasked copy. The site uses no
 * feature flags. Not `advanced_disable_flags`, which also skips PostHog's remote config, and so
 * session replay (seen in a real browser: no `/s/` request).
 */
export const POSTHOG_PRIVACY_CONFIG = {
  mask_all_text: true,
  mask_all_element_attributes: true,
  mask_personal_data_properties: true,
  custom_personal_data_properties: Object.keys(SECRET_PARAMS),
  request_batching: false,
  advanced_disable_feature_flags: true,
  before_send: posthogBeforeSend,
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: "*",
    blockClass: REPLAY_BLOCK_CLASS,
    maskCapturedNetworkRequestFn: maskReplayNetworkEntry,
  },
} as const;

/** Share of tracked sessions with a Mixpanel replay; `syncReplayForPage` applies it, not the SDK. */
export const MIXPANEL_REPLAY_PERCENT = 100;

/**
 * Mixpanel replays take the page URL straight from the address bar with no hook, so a page
 * whose URL still carries a secret is not recorded at all, and neither is an admin page.
 */
function mixpanelMayRecord(href: string): boolean {
  return analyticsAllowedOnPath(pagePath(href)) && sanitizeUrl(href) === href;
}

/**
 * Mixpanel holds a new replay's frames in the browser until it has this much activity, and a
 * replay stopped before then is discarded unsent. That is what makes a recorder which came up on
 * an admin page, and was stopped by `syncReplayForPage` right after, send nothing. Also drops
 * replays shorter than 3 seconds, which are of no use anyway.
 */
export const MIXPANEL_REPLAY_MIN_MS = 3000;

/**
 * mixpanel-browser init options. Replay masks all text and inputs. The SDK never starts a replay
 * on its own (`record_sessions_percent: 0`): `syncReplayForPage` starts and stops it per page.
 *
 * `batch_requests: false`: batched events are stored in localStorage before the hook runs, and
 * events left from a closed tab are sent on a later load without `before_send_events`, so with
 * their URLs unsanitized. Unbatched, every event passes the hook when it is tracked. With
 * batching off the SDK never reads a queue stored by an earlier visit, so none is sent.
 *
 * Profile (`/engage`) and group updates go through their own hooks, not `before_send_events`.
 * The site keeps no Mixpanel profiles, and the SDK's own profile updates carry the first referrer
 * unsanitized, so both hooks drop every update. (`analytics.ts` never calls `identify`, which
 * would send them, and its `$identify` event, past every hook.)
 */
export function mixpanelPrivacyConfig() {
  return {
    batch_requests: false,
    autocapture: { capture_text_content: false },
    record_sessions_percent: 0,
    record_min_ms: MIXPANEL_REPLAY_MIN_MS,
    record_mask_all_text: true,
    record_mask_all_inputs: true,
    // Mixpanel's default classes plus ours.
    record_block_class: new RegExp(`^(${REPLAY_BLOCK_CLASS}|mp-block|fs-exclude|amp-block|rr-block)$`),
    hooks: { before_send_events: mixpanelBeforeSend, before_send_people: () => null, before_send_groups: () => null },
  };
}

/** A public page in a tracked browser: the only place an SDK may start, capture or record. */
function trackedPublicPage(page: { href: string; trackingDisabled: boolean }): boolean {
  return !page.trackingDisabled && analyticsAllowedOnPath(pagePath(page.href));
}

/** SDKs that finished loading and have not been initialised yet. */
export type LoadedSdks<P, M> = { readonly posthog: P | null; readonly mixpanel: M | null };

/**
 * Initialises the SDKs that finished loading, if the page they finished on is a public page in a
 * tracked browser. A load that finishes after an opt-out or a client navigation into an admin,
 * capability or sign-in page initialises nothing, and the SDK waits (it is returned) for a later
 * call. Returns the SDKs still waiting.
 *
 * After init it runs `syncCapture` (syncCaptureForPage), and only then `flush` (the events
 * tracked while the SDKs loaded). The SDKs keep an opt-out from a tab that was closed on a private
 * page; flushed before it is lifted, those events would be dropped.
 */
export function initLoadedSdks<P, M>(
  page: { href: string; trackingDisabled: boolean },
  loaded: LoadedSdks<P, M>,
  init: { posthog(sdk: P): void; mixpanel(sdk: M): void; syncCapture(): void; flush(): void },
): LoadedSdks<P, M> {
  if (!trackedPublicPage(page)) return loaded;
  if (loaded.posthog) init.posthog(loaded.posthog);
  if (loaded.mixpanel) init.mixpanel(loaded.mixpanel);
  if (loaded.posthog || loaded.mixpanel) {
    init.syncCapture();
    init.flush();
  }
  return { posthog: null, mixpanel: null };
}

/** posthog-js session replay controls. */
export type PosthogReplay = {
  stopSessionRecording(): void;
  startSessionRecording(): void;
};

/** mixpanel-browser session replay controls. */
export type MixpanelReplay = {
  stop_session_recording(): unknown;
  start_session_recording(): unknown;
  get_session_recording_properties(): { $mp_replay_id?: string };
};

/** posthog-js capture controls. Its replay snapshots are captured events, so they stop too. */
export type PosthogCapture = {
  has_opted_out_capturing(): boolean;
  opt_out_capturing(): void;
  opt_in_capturing(options: { captureEventName: false }): void;
};

/** mixpanel-browser tracking controls. An opt-out also stops its replay and clears queued sends. */
export type MixpanelTracking = {
  has_opted_out_tracking(): boolean;
  opt_out_tracking(options: { delete_user: false }): void;
  opt_in_tracking(options: { track: () => void }): void;
};

/**
 * Call on every client navigation (including one that only changes the query) and after each SDK
 * initialises, before `syncReplayForPage`. After an opt-out, and on an admin, capability or
 * sign-in page, it turns both SDKs' own capture off: nothing is captured, sent or recorded, and a
 * replay buffer flushed by the stop that follows is dropped. On a public page in a tracked browser
 * it turns capture back on, sending no opt-in event, so the replay start that follows is not
 * refused. The SDKs keep their opt-out in this browser, so it is also turned back on when a later
 * visit loads them where tracking is allowed.
 */
export function syncCaptureForPage(
  page: { href: string; trackingDisabled: boolean },
  sdk: { posthog: PosthogCapture | null; mixpanel: MixpanelTracking | null },
): void {
  const allowed = trackedPublicPage(page);
  if (sdk.posthog) {
    const off = sdk.posthog.has_opted_out_capturing();
    if (!allowed && !off) sdk.posthog.opt_out_capturing();
    else if (allowed && off) sdk.posthog.opt_in_capturing({ captureEventName: false });
  }
  if (sdk.mixpanel) {
    const off = sdk.mixpanel.has_opted_out_tracking();
    // Keeps the person profile; Mixpanel would otherwise send a delete for it.
    if (!allowed && !off) sdk.mixpanel.opt_out_tracking({ delete_user: false });
    else if (allowed && off) sdk.mixpanel.opt_in_tracking({ track: () => undefined });
  }
}

/**
 * What `syncReplayForPage` did last: the PostHog replay it paused, the Mixpanel replay it started,
 * and whether a Mixpanel recorder it stopped before it was running may still come up (then the
 * caller must run `syncReplayForPage` again shortly, until this clears).
 */
export type ReplayState = {
  readonly posthogPaused: boolean;
  readonly mixpanelStarted: boolean;
  readonly mixpanelStopPending: boolean;
};

export const INITIAL_REPLAY_STATE: ReplayState = { posthogPaused: false, mixpanelStarted: false, mixpanelStopPending: false };

/**
 * Call on every client navigation, after each SDK loads, and again shortly while
 * `mixpanelStopPending`. Without it a visitor who opens a public page and then follows a link to
 * an admin or capability page keeps being recorded there.
 *
 * PostHog keeps its own sampling: on admin pages (and for automated or opted-out browsers) its
 * replay is stopped, which also keeps a recorder that is still loading from starting, and only a
 * replay this function stopped is resumed, without overrides.
 *
 * Mixpanel never starts by itself, so this is its only start: on a public page with no secret in
 * the URL, in a tracked and sampled browser. Anywhere else it is stopped, whether or not a replay
 * id exists yet. Mixpanel's start finishes asynchronously (the recorder reads IndexedDB first)
 * and a stop issued before then cannot cancel it, so after such a stop `mixpanelStopPending` asks
 * for re-checks, and the recorder is stopped as soon as it reports a replay id. It is stopped
 * well inside MIXPANEL_REPLAY_MIN_MS, so Mixpanel discards what it held and sends nothing.
 */
export function syncReplayForPage(
  state: ReplayState,
  page: { href: string; trackingDisabled: boolean; mixpanelSampled: boolean },
  sdk: { posthog: PosthogReplay | null; mixpanel: MixpanelReplay | null },
): ReplayState {
  const publicPage = trackedPublicPage(page);
  let { posthogPaused, mixpanelStarted, mixpanelStopPending } = state;
  if (sdk.posthog) {
    if (!publicPage && !posthogPaused) {
      sdk.posthog.stopSessionRecording();
      posthogPaused = true;
    } else if (publicPage && posthogPaused) {
      sdk.posthog.startSessionRecording();
      posthogPaused = false;
    }
  }
  if (sdk.mixpanel) {
    const record = publicPage && page.mixpanelSampled && mixpanelMayRecord(page.href);
    const running = "$mp_replay_id" in sdk.mixpanel.get_session_recording_properties();
    if (record) {
      if (!mixpanelStarted) sdk.mixpanel.start_session_recording();
      mixpanelStarted = true;
      mixpanelStopPending = false;
    } else if (mixpanelStarted || running) {
      sdk.mixpanel.stop_session_recording();
      mixpanelStopPending = mixpanelStarted && !running;
      mixpanelStarted = false;
    }
  }
  return { posthogPaused, mixpanelStarted, mixpanelStopPending };
}
