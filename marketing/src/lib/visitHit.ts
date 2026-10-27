/**
 * The page-view hit behind founder stats (`/api/stats/hit`): an anonymous id, hashed by the server,
 * and on pages where analytics may run, the visit's first-touch utm_source and utm_campaign, which
 * the server counts once per visitor per day in `site_events_daily`. Opted-out and automated
 * browsers send nothing; admin, capability and sign-in pages send the hit without the channel.
 */

import { analyticsAllowedOnPath } from "@/lib/analyticsPrivacy";
import { rememberFirstTouch, type FirstTouch } from "@/lib/siteEvents";
import { browserTrackingDisabled, type OptOutStorage } from "@/lib/trackingOptOut";

const ANON_KEY = "unvibe_anon_id";

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

/** Sends this page load's hit. Best effort; never throws. */
export function sendVisitHit(): void {
  const { pathname, search } = window.location;
  if (shouldSkip(pathname) || browserTrackingDisabled()) return;
  let storage: OptOutStorage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  const channel: FirstTouch | undefined = analyticsAllowedOnPath(pathname) ? rememberFirstTouch(search, storage) : undefined;
  void fetch("/api/stats/hit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ visitorId: anonId(storage), channel }),
    keepalive: true,
  }).catch(() => undefined);
}
