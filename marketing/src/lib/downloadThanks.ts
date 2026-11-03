/**
 * The "thanks for downloading" hand-off (Design spec thanks-for-downloading-2026-11-02).
 *
 * A plain click on a download button keeps its tracking, then, instead of downloading in place,
 * writes a one-time token to sessionStorage and opens /download/thanks?os=…&from=…. That page
 * starts the file only for a fresh token for the same file, and deletes the token first, so a
 * reload, Back or a shared link never downloads again. The anchors keep their real GitHub href,
 * so without JavaScript, and for modified, middle or right clicks, the browser downloads as before.
 *
 * Every file name and URL here comes from the release constants in betaInstallScript.ts (the same
 * values betaOffer.ts exports for the buttons), and the query string only ever selects one of
 * them: no URL, file name or version is taken from it.
 */

import {
  BETA_MAC_DIRECT_DOWNLOAD,
  BETA_MAC_INTEL_DIRECT_DOWNLOAD,
  BETA_WINDOWS_DIRECT_DOWNLOAD,
} from "@/lib/betaOffer";
import { BETA_INSTALL_ASSET, BETA_MAC_INTEL_ASSET, BETA_WINDOWS_ASSET } from "@/lib/betaInstallScript";
import { downloadSurface, thanksOs, type DownloadSurface, type ThanksOs } from "@/lib/downloadTracking";

export const THANKS_PATH = "/download/thanks";
export const THANKS_TOKEN_KEY = "unvibe.dl";
/** A token older than this is ignored: the click that wrote it was not this page view. */
export const THANKS_TOKEN_MAX_AGE_MS = 60_000;

export interface ThanksDownload {
  href: string;
  /** The file name the steps show; a test keeps it equal to the href's last path segment. */
  file: string;
}

export const THANKS_DOWNLOADS: Readonly<Record<ThanksOs, ThanksDownload>> = {
  mac: { href: BETA_MAC_DIRECT_DOWNLOAD, file: BETA_INSTALL_ASSET },
  "mac-intel": { href: BETA_MAC_INTEL_DIRECT_DOWNLOAD, file: BETA_MAC_INTEL_ASSET },
  windows: { href: BETA_WINDOWS_DIRECT_DOWNLOAD, file: BETA_WINDOWS_ASSET },
};

/** Which file a download button's href starts, or null for any other link (/beta, the email link). */
export function thanksOsForHref(href: string): ThanksOs | null {
  for (const [os, download] of Object.entries(THANKS_DOWNLOADS) as Array<[ThanksOs, ThanksDownload]>) {
    if (download.href === href) return os;
  }
  return null;
}

/** The thanks page for one file; both values are already allowlisted. */
export function thanksHref(os: ThanksOs, from: DownloadSurface | "other"): string {
  return `${THANKS_PATH}?os=${os}&from=${from}`;
}

/**
 * Security SHOULD-TD6: the allowlisted form of an incoming /download/thanks query, or null when it
 * already is one. The server page redirects to it, so a raw `?from=`, an unknown `?os=` or any other
 * parameter never reaches the address bar, where a page view reads the URL. An unknown `os` is
 * dropped rather than guessed, so the client still decides the system and the token exactly as it
 * does with no `os` at all.
 */
export function thanksCanonicalHref(query: Readonly<Record<string, string | string[] | undefined>>): string | null {
  const os = typeof query.os === "string" ? thanksOs(query.os) : "other";
  const from = typeof query.from === "string" ? downloadSurface(query.from) : null;
  const canonical = new URLSearchParams();
  if (os !== "other") canonical.set("os", os);
  if (from !== null) canonical.set("from", from);
  const incoming = Object.entries(query).filter(([, value]) => value !== undefined);
  const same = incoming.length === Array.from(canonical.keys()).length
    && incoming.every(([key, value]) => typeof value === "string" && canonical.get(key) === value);
  if (same) return null;
  const search = canonical.toString();
  return search ? `${THANKS_PATH}?${search}` : THANKS_PATH;
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Reads and deletes the click token (deleted before anything else happens), and says whether it
 * was written for `os` less than THANKS_TOKEN_MAX_AGE_MS ago. Blocked storage counts as no token.
 */
export function takeThanksToken(os: ThanksOs | "other", now = Date.now()): boolean {
  const store = sessionStore();
  let raw: string | null;
  try {
    raw = store?.getItem(THANKS_TOKEN_KEY) ?? null;
    store?.removeItem(THANKS_TOKEN_KEY);
  } catch {
    return false;
  }
  if (raw === null || os === "other") return false;
  let token: unknown;
  try {
    token = JSON.parse(raw);
  } catch {
    return false;
  }
  if (typeof token !== "object" || token === null) return false;
  const { asset, at } = token as { asset?: unknown; at?: unknown };
  if (asset !== os || typeof at !== "number") return false;
  const age = now - at;
  return age >= 0 && age < THANKS_TOKEN_MAX_AGE_MS;
}

// The layout's DownloadThanksRouter registers the app router here, so the hand-off is a client
// navigation: the page that just sent `download_cta_clicked` is not unloaded under the request.
let clientNavigate: ((href: string) => void) | null = null;

/** Lets `openThanks` use the app router; returns the cleanup. */
export function registerThanksNavigation(navigate: (href: string) => void): () => void {
  clientNavigate = navigate;
  return () => {
    if (clientNavigate === navigate) clientNavigate = null;
  };
}

/** Writes the one-time token for `os` and opens its thanks page. Call after the click is tracked. */
export function openThanks(os: ThanksOs, from: DownloadSurface, navigate = clientNavigate): void {
  try {
    sessionStore()?.setItem(THANKS_TOKEN_KEY, JSON.stringify({ asset: os, at: Date.now() }));
  } catch {
    // Storage blocked: the thanks page shows its manual download instead.
  }
  const href = thanksHref(os, from);
  // Already on the thanks page (the ⌘K palette there), a client navigation would keep the mounted
  // page, which reads the token only once, so that one reloads.
  if (navigate && window.location.pathname !== THANKS_PATH) navigate(href);
  else window.location.href = href;
}

/** The parts of a click event the hand-off reads (a React or DOM mouse event). */
export interface DownloadClick {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  preventDefault(): void;
}

/**
 * For a download anchor's onClick, after its tracking: a plain primary click opens the thanks page
 * instead of the file. Modified clicks (new tab, save, download) and handled events are left alone.
 */
export function thanksClick(event: DownloadClick, os: ThanksOs, from: DownloadSurface): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openThanks(os, from);
}

/** Caption text: plain strings, and `{ b }` for the words to look for on screen. */
export type ThanksSegment = string | { b: string };

export type ThanksScene = "mac-downloads" | "mac-drag" | "mac-open-anyway" | "win-keep" | "win-run" | "win-run-anyway";

export interface ThanksStep {
  scene: ThanksScene;
  caption: ThanksSegment[];
}

/**
 * The three first-open steps for one file. Every word is Security-reviewed (MUST-TD1 for the Mac
 * step 3 wording) and restates FirstOpenSteps: a test checks each bold word here is emphasised there.
 */
export function thanksSteps(os: ThanksOs): ThanksStep[] {
  const { file } = THANKS_DOWNLOADS[os];
  if (os === "windows") {
    return [
      { scene: "win-keep", caption: ["If your browser asks, choose ", { b: "Keep" }, " (in Edge: ", { b: "… → Keep → Show more → Keep anyway" }, ")."] },
      { scene: "win-run", caption: ["Run ", { b: file }, " from your Downloads."] },
      {
        scene: "win-run-anyway",
        caption: ["On ", { b: "Windows protected your PC" }, ", press ", { b: "More info" }, ", then ", { b: "Run anyway" }, ". The Windows build isn't code-signed yet."],
      },
    ];
  }
  return [
    { scene: "mac-downloads", caption: ["Open ", { b: file }, " from your Downloads."] },
    { scene: "mac-drag", caption: ["Drag ", { b: "Unvibe" }, " onto ", { b: "Applications" }, " in the window that opens."] },
    {
      scene: "mac-open-anyway",
      caption: [
        "Open Unvibe. macOS stops it the first time because it isn't notarized yet: press Done, then ",
        { b: "System Settings → Privacy & Security → Open Anyway" },
        ", confirm, and enter your Mac password.",
      ],
    },
  ];
}
