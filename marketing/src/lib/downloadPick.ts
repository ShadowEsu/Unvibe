import { BETA_MAC_DIRECT_DOWNLOAD, BETA_MAC_INTEL_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import { detectVisitorDevice } from "@/lib/shortcuts";

/**
 * Which v0.1.49 file a "Download free" click starts (Preston, 6 Nov: "instantly download … locate if it's Mac or
 * Windows but generally go Mac"). Windows gets the Windows file the site already offers; every other computer gets a
 * Mac file. Apple silicon unless the browser says Intel: Chromium's client hints (`architecture` "x86") or, failing
 * that, a WebGL renderer that names an Intel, AMD or NVIDIA GPU. Safari can't tell (it reports Intel on every Mac and
 * masks the GPU), so the default stays Apple silicon and the page offers the Intel file one click away.
 * Phones can't run the app: they get no file, and the button keeps its /beta link (the emailed-link form).
 */
export type DownloadKey = "mac-arm" | "mac-intel" | "windows";

export const DOWNLOAD_FILES: Record<DownloadKey, { url: string; os: "mac" | "windows"; label: string }> = {
  "mac-arm": { url: BETA_MAC_DIRECT_DOWNLOAD, os: "mac", label: "Mac (Apple silicon)" },
  "mac-intel": { url: BETA_MAC_INTEL_DIRECT_DOWNLOAD, os: "mac", label: "Mac (Intel)" },
  windows: { url: BETA_WINDOWS_DIRECT_DOWNLOAD, os: "windows", label: "Windows" },
};

export function isDownloadKey(value: string | null | undefined): value is DownloadKey {
  return value === "mac-arm" || value === "mac-intel" || value === "windows";
}

export interface ArchHints {
  /** navigator.userAgentData.getHighEntropyValues(["architecture"]).architecture, when the browser answered. */
  uaArchitecture?: string;
  /** The WebGL UNMASKED_RENDERER_WEBGL string, when the browser exposes it. */
  webglRenderer?: string;
}

/** Intel when a hint says so; Apple silicon otherwise (the default). */
export function macArch(hints: ArchHints): "arm" | "intel" {
  const arch = hints.uaArchitecture?.toLowerCase();
  if (arch === "x86") return "intel";
  if (arch === "arm") return "arm";
  const gl = hints.webglRenderer ?? "";
  if (/apple (m\d|gpu)/i.test(gl)) return "arm";
  if (/intel|amd|radeon|nvidia|geforce/i.test(gl)) return "intel";
  return "arm";
}

/** The file for this visitor, or null on a phone or tablet. `forced` is the page's `?os=mac|win` override. */
export function pickDownload(userAgent: string, maxTouchPoints: number, hints: ArchHints, forced?: string | null): DownloadKey | null {
  if (forced === "win") return "windows";
  if (forced !== "mac") {
    const device = detectVisitorDevice(userAgent, maxTouchPoints);
    if (device === "phone") return null;
    if (device === "windows") return "windows";
  }
  return macArch(hints) === "intel" ? "mac-intel" : "mac-arm";
}
