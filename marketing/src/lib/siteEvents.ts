/**
 * First-party daily channel counts (`site_events_daily`): download clicks by surface and platform,
 * and visitors by first-touch utm_source and utm_campaign, counted once per visitor per day. Rows
 * hold counts only: never a visitor id, ref code, IP address or user agent. Utm values are kept
 * only when they are in Marketing's UTM dictionary; anything else is counted as "other".
 */

import type { OptOutStorage } from "@/lib/trackingOptOut";

export const DOWNLOAD_SURFACES = [
  "hero",
  "hero_other_os",
  "nav",
  "mobile_bar",
  "palette",
  "beta",
  "home_install",
  "investors",
  "home_cta",
  "try_it",
  "try_it_answer",
  "activate",
  "explain",
  "explain_answer",
  "explain_try",
  "pricing",
  "footer",
  "releases",
  "build",
  "resources",
  "redeem",
] as const;

export type DownloadSurface = (typeof DOWNLOAD_SURFACES)[number];

export const DOWNLOAD_PLATFORMS = ["mac", "windows", "other"] as const;

export type DownloadPlatform = (typeof DOWNLOAD_PLATFORMS)[number];

/** Download events the site counts first-party, besides sending them to Mixpanel and PostHog. */
export const SITE_COUNT_EVENTS = ["download_cta_clicked", "release_download_clicked"] as const;

export type SiteCountEvent = (typeof SITE_COUNT_EVENTS)[number];

/** One counter in `site_events_daily`; the day is added by the server. */
export interface SiteEventCount {
  event: SiteCountEvent | "visit_source";
  /** surface, or utm_source ("direct" when there is none) */
  dim1: string;
  /** platform, or utm_campaign ("none" when there is none) */
  dim2: string;
}

const OTHER = "other";
const UTM_MAX = 40;

/**
 * utm_source values from Marketing's UTM dictionary: owned channels, then the launch sites that
 * link with `?utm_source=<site>`. A new source goes into the dictionary and this list together.
 */
const UTM_SOURCES: ReadonlySet<string> = new Set([
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "linkedin",
  "github",
  "slack",
  // Feedback's outreach email, one campaign tag per send day (Security U3, 2 Nov).
  "outreach",
  "peerpush",
  "sideprojectors",
  "launchingnext",
  "tinylaunch",
  "startupfame",
  "fazier",
  "futuretools",
  "saashub",
  "uneed",
  "startupbase",
  "devhunt",
  "whatlaunchedtoday",
  "devpost",
]);

/** Fixed utm_campaign values; `carousel-<slug>`, `x-<post id>` and `short-<id>` follow the pattern. */
const UTM_CAMPAIGNS: ReadonlySet<string> = new Set(["profile", "channel", "readme", "release-notes"]);
const UTM_CAMPAIGN_PATTERN = /^(?:carousel|x|short)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Sets, not object literals: these keys come from the browser, and `constructor` or `__proto__`
// would otherwise resolve to Object.prototype members.
const SURFACES: ReadonlySet<string> = new Set(DOWNLOAD_SURFACES);
const PLATFORMS: ReadonlySet<string> = new Set(DOWNLOAD_PLATFORMS);

/** A dictionary utm_source, "direct" when there is none, else "other". */
export function normalizeUtmSource(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) return "direct";
  return value.length <= UTM_MAX && UTM_SOURCES.has(value) ? value : OTHER;
}

/** A dictionary utm_campaign, "none" when there is none, else "other". */
export function normalizeUtmCampaign(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) return "none";
  if (value.length > UTM_MAX) return OTHER;
  return UTM_CAMPAIGNS.has(value) || UTM_CAMPAIGN_PATTERN.test(value) ? value : OTHER;
}

/** A download click from the browser, or null for an event that isn't counted. */
export function parseSiteCount(body: unknown): SiteEventCount | null {
  if (!body || typeof body !== "object") return null;
  const event = SITE_COUNT_EVENTS.find((name) => name === Reflect.get(body, "event"));
  if (!event) return null;
  const surface: unknown = Reflect.get(body, "surface");
  const platform: unknown = Reflect.get(body, "platform");
  return {
    event,
    dim1: typeof surface === "string" && SURFACES.has(surface) ? surface : OTHER,
    dim2: typeof platform === "string" && PLATFORMS.has(platform) ? platform : OTHER,
  };
}

/** The visit's first-touch channel sent with a page hit, or null when the page sent none. */
export function parseVisitSource(channel: unknown): SiteEventCount | null {
  if (!channel || typeof channel !== "object") return null;
  return {
    event: "visit_source",
    dim1: normalizeUtmSource(Reflect.get(channel, "source")),
    dim2: normalizeUtmCampaign(Reflect.get(channel, "campaign")),
  };
}

/** The first tagged landing's utm_source and utm_campaign, as typed (normalized by the server). */
export interface FirstTouch {
  source: string;
  campaign: string;
}

export const FIRST_TOUCH_KEY = "unvibe.firstTouch";
/** A first touch older than this is dropped; the next tagged landing becomes the first touch. */
export const FIRST_TOUCH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Longer than any dictionary value, so an overlong tag still reads as "other". */
const STORED_MAX = 64;

/** The stored first touch, or null when there is none, it is unreadable, or it has expired. */
function readFirstTouch(saved: string | null, now: number): FirstTouch | null {
  if (!saved) return null;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") return null;
    const source: unknown = Reflect.get(parsed, "source");
    const campaign: unknown = Reflect.get(parsed, "campaign");
    const at: unknown = Reflect.get(parsed, "at");
    if (typeof source !== "string" || !source) return null;
    if (typeof at !== "number" || !(now - at < FIRST_TOUCH_MAX_AGE_MS)) return null;
    return { source, campaign: typeof campaign === "string" ? campaign : "" };
  } catch {
    return null;
  }
}

/**
 * Keeps the first landing that carried a utm_source for 30 days (later tagged visits don't replace
 * it until it expires) and returns it; empty values for a visitor with no live first touch. Only
 * the two tags are read, never `ref`. Call only where analytics may run (see visitHit.ts).
 */
export function rememberFirstTouch(search: string, storage: OptOutStorage | null, now = Date.now()): FirstTouch {
  const params = new URLSearchParams(search);
  const current: FirstTouch = {
    source: (params.get("utm_source") ?? "").trim().toLowerCase().slice(0, STORED_MAX),
    campaign: (params.get("utm_campaign") ?? "").trim().toLowerCase().slice(0, STORED_MAX),
  };
  try {
    const saved = readFirstTouch(storage?.getItem(FIRST_TOUCH_KEY) ?? null, now);
    if (saved) return saved;
    if (current.source) storage?.setItem(FIRST_TOUCH_KEY, JSON.stringify({ ...current, at: now }));
    else storage?.removeItem(FIRST_TOUCH_KEY);
  } catch {
    // Storage blocked: this page's tags still count for this visit.
  }
  return current.source ? current : { source: "", campaign: "" };
}
