/**
 * Where a visitor who copies the install command first came from, as one coarse label (attribution,
 * BOSS ledger 453). The label is picked from a fixed list from the same link values the waitlist
 * keeps (utm_source, utm_medium, ref); the raw values, the campaign and any referral code are never
 * sent or stored. Anything not on the list becomes "other".
 *
 * The browser keeps the first label under `unvibe.firstSource`, written only once the visitor has
 * pressed Allow on the analytics bar (analytics.ts calls `rememberFirstSource` from the same path
 * that starts analytics) and removed on No thanks. It goes to the server only with the `copied`
 * install count, which is itself sent only with that consent (`recordBetaSiteEvent`).
 */
import { storedRef } from "@/lib/referral";

export const INSTALL_SOURCES = [
  "direct",
  "search",
  "referral",
  "reddit",
  "hacker_news",
  "x",
  "youtube",
  "tiktok",
  "linkedin",
  "product_hunt",
  "github",
  "directory",
  "email",
  "app",
  "other",
] as const;
export type InstallSource = (typeof INSTALL_SOURCES)[number];

export const FIRST_SOURCE_KEY = "unvibe.firstSource";

/** Link values are public URL input: only this many characters are ever looked at. */
const TAG_MAX = 64;

/** utm_source or ref values, lowercased, that map to a label. */
const SOURCE_BY_TAG: Record<string, InstallSource> = {
  google: "search",
  bing: "search",
  duckduckgo: "search",
  ddg: "search",
  yahoo: "search",
  brave: "search",
  ecosia: "search",
  kagi: "search",
  baidu: "search",
  yandex: "search",
  search: "search",
  reddit: "reddit",
  hackernews: "hacker_news",
  hacker_news: "hacker_news",
  hn: "hacker_news",
  ycombinator: "hacker_news",
  x: "x",
  twitter: "x",
  "x.com": "x",
  "t.co": "x",
  youtube: "youtube",
  yt: "youtube",
  tiktok: "tiktok",
  linkedin: "linkedin",
  producthunt: "product_hunt",
  product_hunt: "product_hunt",
  github: "github",
  directory: "directory",
  badge: "directory",
  toolindex: "directory",
  smolstartup: "directory",
  launchkiwi: "directory",
  devrove: "directory",
  aitooldiscovery: "directory",
  viberank: "directory",
  sideprojectors: "directory",
  launchbuff: "directory",
  tinylaunch: "directory",
  uneed: "directory",
  foundermag: "directory",
  startupfame: "directory",
  fazier: "directory",
  futurepedia: "directory",
  theresanaiforthat: "directory",
  alternativeto: "directory",
  saashub: "directory",
  betalist: "directory",
  email: "email",
  newsletter: "email",
  app: "app",
};

/** utm_medium values that decide the label when utm_source is not on the list. */
const SOURCE_BY_MEDIUM: Record<string, InstallSource> = {
  email: "email",
  newsletter: "email",
  organic: "search",
  cpc: "search",
  search: "search",
  directory: "directory",
  listing: "directory",
};

function lookup(table: Record<string, InstallSource>, value: string): InstallSource | undefined {
  return Object.hasOwn(table, value) ? table[value] : undefined;
}

/**
 * The label for a page address. Order: utm_source (then utm_medium) when present, then a friend's
 * referral code, then a `ref` value on the list, else "direct". Never returns any part of the input.
 */
export function installSourceFor(search: string, hasFriendCode: boolean): InstallSource {
  const params = new URLSearchParams(search);
  const tag = (name: string) => (params.get(name) ?? "").slice(0, TAG_MAX).trim().toLowerCase();
  const source = tag("utm_source");
  if (source) return lookup(SOURCE_BY_TAG, source) ?? lookup(SOURCE_BY_MEDIUM, tag("utm_medium")) ?? "other";
  if (hasFriendCode) return "referral";
  const ref = tag("ref");
  if (ref) return lookup(SOURCE_BY_TAG, ref) ?? "other";
  return "direct";
}

/** Server side: a label from a request body, or null for anything not on the list. */
export function parseInstallSource(value: unknown): InstallSource | null {
  return typeof value === "string" && (INSTALL_SOURCES as readonly string[]).includes(value) ? (value as InstallSource) : null;
}

function currentPageSource(): InstallSource {
  return installSourceFor(window.location?.search ?? "", storedRef() !== "");
}

/** Stores this page's label unless one is stored already. Callers check analytics consent first. */
export function rememberFirstSource(): void {
  if (typeof window === "undefined") return;
  try {
    if (parseInstallSource(window.localStorage.getItem(FIRST_SOURCE_KEY))) return;
    window.localStorage.setItem(FIRST_SOURCE_KEY, currentPageSource());
  } catch {
    // Storage blocked: firstSource() falls back to the current page.
  }
}

/** No thanks: the stored label is removed. */
export function forgetFirstSource(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FIRST_SOURCE_KEY);
  } catch {
    // Storage blocked: nothing was stored.
  }
}

/** The stored first label, else this page's. */
export function firstSource(): InstallSource {
  try {
    const stored = parseInstallSource(window.localStorage.getItem(FIRST_SOURCE_KEY));
    if (stored) return stored;
  } catch {
    // Storage blocked: use this page.
  }
  return currentPageSource();
}
