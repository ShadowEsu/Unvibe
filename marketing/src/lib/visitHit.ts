/**
 * The page-view hit behind founder stats (`/api/stats/hit`): an anonymous id, hashed by the server,
 * and with the browser's first hit of the day from a page where analytics may run, the visit's
 * first-touch utm_source and utm_campaign, which the server adds to `site_events_daily` as one
 * visit_source count. Opted-out and automated browsers send nothing; admin, capability and sign-in
 * pages send the hit without the channel.
 */

import { analyticsAllowedOnPath } from "@/lib/analyticsPrivacy";
import { rememberFirstTouch, type FirstTouch } from "@/lib/siteEvents";
import { browserTrackingDisabled, type OptOutStorage } from "@/lib/trackingOptOut";

const ANON_KEY = "unvibe_anon_id";
/** The day this browser last sent its channel, as the server's stats day (Pacific, YYYY-MM-DD). */
export const CHANNEL_DAY_KEY = "unvibe.channelDay";

function shouldSkip(pathname: string): boolean {
  return (
    /\/waitlist(?:-admin)?(?:\/|$)/.test(pathname) ||
    /\/(?:stats(?:\.html)?|founder)(?:\/|$)/i.test(pathname) ||
    pathname.startsWith("/api/")
  );
}

function anonId(storage: OptOutStorage | null): string {
  try {
    let id = storage?.getItem(ANON_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      storage?.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
}

/**
 * True once per stats day: the server buckets days in America/Los_Angeles (siteStatsStore dayKey),
 * so the stamp does too. With storage blocked every hit says true, as each such hit is also a new
 * visitor id.
 */
function firstChannelToday(storage: OptOutStorage | null, now: Date): boolean {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
  try {
    if (storage?.getItem(CHANNEL_DAY_KEY) === today) return false;
    storage?.setItem(CHANNEL_DAY_KEY, today);
  } catch {
    // Storage blocked: nothing to compare with.
  }
  return true;
}

/** Sends this page load's hit. Best effort; never throws. */
export function sendVisitHit(now = new Date()): void {
  const { pathname, search } = window.location;
  if (shouldSkip(pathname) || browserTrackingDisabled()) return;
  let storage: OptOutStorage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  let channel: FirstTouch | undefined;
  if (analyticsAllowedOnPath(pathname)) {
    const firstTouch = rememberFirstTouch(search, storage, now.getTime());
    if (firstChannelToday(storage, now)) channel = firstTouch;
  }
  void fetch("/api/stats/hit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ visitorId: anonId(storage), channel }),
    keepalive: true,
  }).catch(() => undefined);
}
