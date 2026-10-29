/**
 * Download measurement for the marketing site. Every event goes through `track`, so nothing is
 * sent for `?notrack=1`, automated browsers or private pages, and props are fixed short values.
 *
 * `download_cta_clicked {surface, platform}`, platform mac | windows | other:
 * - Downloads the installer: hero, hero_other_os, palette, beta, home_install, investors,
 *   home_cta, try_it (after a failed try), try_it_answer (under a finished try-it answer),
 *   activate (the /activate first-visit download), redeem (after a promo code on /redeem), and on
 *   the /explain pages: explain (the page's download section), explain_answer and explain_try
 *   (their Try it box, as try_it_answer and try_it), and seo_mac / seo_windows (the download on
 *   /code-explainer-mac and /code-explainer-windows).
 * - Opens the download page (/beta) instead: nav, mobile_bar, pricing, footer, releases, build,
 *   resources. Of these, only the DownloadLink buttons (nav, releases, build, resources) also
 *   fire DOWNLOADED_EVENT, as they always have.
 *
 * `download_cta_viewed {surface: "hero", platform}`: once per page view, hero CTA half visible.
 * `install_help_viewed {from, os_default}`: once per /install-help view, from home | beta | pricing |
 * installer | other; os_default (mac | windows) is the tab the first-open steps opened on.
 */

import { track } from "@/lib/analytics";
import { visitorInstallOs } from "@/lib/shortcuts";

/** Window event after a download click; ReminderToast offers the setup email on it. */
export const DOWNLOADED_EVENT = "unvibe:downloaded";

export type DownloadPlatform = "mac" | "windows" | "other";

export type DownloadSurface =
  | "hero"
  | "hero_other_os"
  | "nav"
  | "mobile_bar"
  | "palette"
  | "beta"
  | "home_install"
  | "investors"
  | "home_cta"
  | "try_it"
  | "try_it_answer"
  | "activate"
  | "explain"
  | "explain_answer"
  | "explain_try"
  | "seo_mac"
  | "seo_windows"
  | "pricing"
  | "footer"
  | "releases"
  | "build"
  | "resources"
  | "redeem";

/** A click on a download button or link. */
export function trackDownloadClick(surface: DownloadSurface, platform: DownloadPlatform): void {
  track("download_cta_clicked", { surface, platform });
  window.dispatchEvent(new Event(DOWNLOADED_EVENT));
}

/** A download call to action that opens the download page (/beta), so nothing downloads yet. */
export function trackDownloadPageClick(surface: DownloadSurface): void {
  track("download_cta_clicked", { surface, platform: "other" });
}

/** Browsers can report a ratio a hair under the threshold they just crossed. */
const HALF_VISIBLE = 0.5;
const RATIO_SLACK = 0.01;

/**
 * Sends `download_cta_viewed` once, the first time `element` is at least half visible.
 * Returns the cleanup; call it on unmount. No IntersectionObserver, no event.
 */
export function watchDownloadCtaView(element: Element, surface: DownloadSurface, platform: DownloadPlatform): () => void {
  const Observer = window.IntersectionObserver;
  if (typeof Observer !== "function") return () => undefined;
  let seen = false;
  const observer = new Observer(
    (entries) => {
      if (seen) return;
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= HALF_VISIBLE - RATIO_SLACK)) return;
      seen = true;
      observer.disconnect();
      track("download_cta_viewed", { surface, platform });
    },
    { threshold: HALF_VISIBLE },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

export type InstallHelpSource = "home" | "beta" | "pricing" | "installer" | "other";

// Maps, not object literals: the keys come from the URL, and `constructor` or `__proto__`
// would otherwise resolve to Object.prototype members.
const INSTALL_HELP_SOURCES = new Map<string, InstallHelpSource>([
  ["home", "home"],
  ["beta", "beta"],
  ["pricing", "pricing"],
  ["installer", "installer"],
]);

/** Same-site pages that link to /install-help, by path. */
const SOURCE_BY_PATH = new Map<string, InstallHelpSource>([
  ["/", "home"],
  ["/beta", "beta"],
  ["/pricing", "pricing"],
]);

/**
 * Where an /install-help visit came from, as one allowlisted word: `?from=` when present,
 * else the path of a same-site referrer. Everything else, including other sites, is "other".
 */
export function installHelpSource(search: string, referrer: string, host: string): InstallHelpSource {
  const from = new URLSearchParams(search).get("from");
  if (from !== null) return INSTALL_HELP_SOURCES.get(from.trim().toLowerCase()) ?? "other";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "other";
  }
  if (url.host !== host) return "other";
  return SOURCE_BY_PATH.get(url.pathname.replace(/\/+$/, "") || "/") ?? "other";
}

/** `install_help_viewed {from, os_default}`; call once per /install-help page view. */
export function trackInstallHelpViewed(): void {
  if (typeof window === "undefined") return;
  const { location, navigator, document } = window;
  track("install_help_viewed", {
    from: installHelpSource(location.search, document.referrer, location.host),
    os_default: visitorInstallOs(navigator.userAgent, navigator.maxTouchPoints),
  });
}
