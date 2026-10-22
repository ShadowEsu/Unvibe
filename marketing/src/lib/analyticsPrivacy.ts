/**
 * What the site's analytics SDKs may see.
 *
 * - URLs: email links carry the reader's email and a signed token (`/?feedback=1&e=…&t=…`,
 *   `/api/unsubscribe?e=…&t=…`), invite and gift links carry a code (`?ref=`), device sign-in
 *   carries the device code (`/activate?user_code=…`) and the OAuth code (`?code=`), and
 *   `/s/<key>` is itself a capability. These values are replaced with "redacted" in every URL
 *   property PostHog or Mixpanel sends, and in the URLs inside PostHog replays.
 * - Replays: all page text and every input is masked, so names, emails on admin pages and model
 *   explanations of someone's code never reach a replay. New elements are covered by default.
 * - Autocapture: no element text and no element attributes.
 * - Admin and capability pages (`/founder`, `/waitlist`, `/waitlist-admin`, `/s/…`) load no SDK.
 */

import type { BeforeSendFn, CaptureResult } from "posthog-js";

export const REDACTED = "redacted";

/** Query keys whose values identify a person or work as a credential. Compared lower case. */
const SECRET_PARAMS: Record<string, true> = {
  e: true,
  email: true,
  t: true,
  token: true,
  ref: true,
  code: true,
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

/** Pages that render private data or whose URL is a secret. No analytics SDK starts on them. */
const PRIVATE_PATH = /^\/(founder|waitlist|waitlist-admin|s)(\/|$)/;

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

/** PostHog `before_send`: every event, pageview and person update. */
export const posthogBeforeSend: BeforeSendFn = (event: CaptureResult | null) => {
  if (!event) return event;
  return {
    ...event,
    properties: sanitizeProperties(event.properties),
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

/** Mixpanel `before_send_events`: every tracked, autocaptured and pageview event. */
export function mixpanelBeforeSend<T extends { properties: PropertyBag }>(payload: T): T {
  return { ...payload, properties: sanitizeProperties(payload.properties) };
}

/** False on admin and capability pages, where no analytics SDK may start. */
export function analyticsAllowedOnPath(pathname: string): boolean {
  return !PRIVATE_PATH.test(pathname);
}

/**
 * posthog-js init options (besides the host and project defaults). `maskTextSelector: "*"`
 * masks the text of every element, present or future; inputs are masked too.
 */
export const POSTHOG_PRIVACY_CONFIG = {
  mask_all_text: true,
  mask_all_element_attributes: true,
  before_send: posthogBeforeSend,
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: "*",
    maskCapturedNetworkRequestFn: maskReplayNetworkEntry,
  },
} as const;

/**
 * mixpanel-browser init options. Replay masks all text and inputs. Mixpanel replays take the
 * page URL straight from the address bar with no hook, so a page whose URL still carries a
 * secret is not recorded at all.
 */
export function mixpanelPrivacyConfig(currentHref: string) {
  return {
    autocapture: { capture_text_content: false },
    record_sessions_percent: sanitizeUrl(currentHref) === currentHref ? 100 : 0,
    record_mask_all_text: true,
    record_mask_all_inputs: true,
    hooks: { before_send_events: mixpanelBeforeSend },
  };
}
