"use client";

import { useContext, useEffect, type ReactNode } from "react";
// The router from context, not useRouter(): the button also renders where no app router is mounted (the pricing tests'
// static render), and then it falls back to a normal page load.
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { trackDownloadClick, trackDownloadPageClick, type DownloadSurface } from "@/lib/downloadTracking";
import { DOWNLOAD_FILES, pickDownload, type ArchHints, type DownloadKey } from "@/lib/downloadPick";
import { BtnDot } from "./effects";

/** Chromium's client hint, asked once per page load (it's async, so it must be in before the click). */
const hints: ArchHints = {};
let asked = false;
function askArchitecture() {
  if (asked) return;
  asked = true;
  const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (h: string[]) => Promise<{ architecture?: string }> } }).userAgentData;
  void uaData?.getHighEntropyValues?.(["architecture"]).then((v) => {
    hints.uaArchitecture = v.architecture;
  }).catch(() => undefined);
}

/** The GPU's name, read at click time only on a Mac whose browser gave no client hint (Firefox, Safari). */
function webglRenderer(): string | undefined {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const name = gl && info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : undefined;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
}

/** Starts the file download in this tab: the release asset answers as an attachment, so the page stays. */
export function startDownload(key: DownloadKey) {
  const a = document.createElement("a");
  a.href = DOWNLOAD_FILES[key].url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** The thank-you state: /beta with the first-open steps for the file that just started. */
export const thanksHref = (key: DownloadKey) => `/beta?dl=${key}#thanks`;

/** This visitor's file, or null on a phone; `platform` pins Mac or Windows on a computer. */
function fileFor(platform: "mac" | "windows" | undefined): DownloadKey | null {
  const forced = new URLSearchParams(window.location.search).get("os");
  const ua = navigator.userAgent;
  const mac = platform !== "windows" && (forced === "mac" || (forced !== "win" && !/Windows/i.test(ua)));
  const key = pickDownload(ua, navigator.maxTouchPoints, mac && !hints.uaArchitecture ? { webglRenderer: webglRenderer() } : hints, forced);
  if (!key || !platform) return key;
  if (platform === "windows") return "windows";
  return key === "windows" ? "mac-arm" : key;
}

/**
 * Every "Download Unvibe for free" / "Download free" button (Preston, 6 Nov): one click starts the v0.1.49 file for
 * this computer (Windows → the Windows file, everything else → a Mac file, Apple silicon unless the browser says Intel)
 * and opens the thank-you state with its first-open steps (the .dmg isn't notarized). The server HTML is a plain link
 * to /beta, so without JavaScript it opens the download page; phones go to the emailed-link form there.
 * `download_cta_clicked {surface, platform}` fires as before.
 */
export function DownloadCta({ surface, platform, children, className = "d-cta d-btn", dot = true, onClick, ...rest }: {
  surface: DownloadSurface;
  /** Pin the file to one computer (a "Download free for Windows" button); the default detects it. */
  platform?: "mac" | "windows";
  children: ReactNode;
  className?: string;
  dot?: boolean;
  onClick?: () => void;
} & Record<`data-${string}`, string | undefined>) {
  const router = useContext(AppRouterContext);
  useEffect(askArchitecture, []);
  const go = (href: string) => (router ? router.push(href) : window.location.assign(href));
  return (
    <a
      href="/beta"
      className={className}
      data-dl=""
      onClick={(event) => {
        onClick?.();
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        const key = fileFor(platform);
        if (!key) {
          // A phone or tablet can't run the app: the emailed link, on the download page.
          trackDownloadPageClick(surface);
          go("/beta#email-link");
          return;
        }
        trackDownloadClick(surface, DOWNLOAD_FILES[key].os);
        startDownload(key);
        go(thanksHref(key));
      }}
      {...rest}
    >
      {children}
      {dot ? <BtnDot /> : null}
    </a>
  );
}
