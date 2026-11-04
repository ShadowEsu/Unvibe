import { BETA_MAC_DIRECT_DOWNLOAD, BETA_MAC_INTEL_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import { MAC_INTEL_META, MAC_META, MAC_SHA256_URL, WINDOWS_META, WINDOWS_SHA256_URL } from "@/lib/downloadMeta";
import type { VisitorDevice } from "@/lib/shortcuts";

/** The three files the download card offers (Design W10, W11). */
export type DownloadBuild = "mac" | "mac-intel" | "windows";

export interface DownloadOption {
  build: DownloadBuild;
  platform: "mac" | "windows";
  /** The card's one filled button when this build is the visitor's. */
  primaryLabel: string;
  /** The same build in the "other downloads" row. */
  otherLabel: string;
  href: string;
  /** What the file is, in words: platform, version, size. */
  meta: string;
  sha256Url: string;
}

export const DOWNLOADS: Readonly<Record<DownloadBuild, DownloadOption>> = {
  mac: {
    build: "mac",
    platform: "mac",
    primaryLabel: "Download for Mac",
    otherLabel: "Apple silicon Mac",
    href: BETA_MAC_DIRECT_DOWNLOAD,
    meta: MAC_META,
    sha256Url: MAC_SHA256_URL,
  },
  "mac-intel": {
    build: "mac-intel",
    platform: "mac",
    primaryLabel: "Download for Mac",
    otherLabel: "Intel Mac",
    href: BETA_MAC_INTEL_DIRECT_DOWNLOAD,
    meta: MAC_INTEL_META,
    sha256Url: MAC_SHA256_URL,
  },
  windows: {
    build: "windows",
    platform: "windows",
    primaryLabel: "Download for Windows",
    otherLabel: "Windows 10 or 11",
    href: BETA_WINDOWS_DIRECT_DOWNLOAD,
    meta: WINDOWS_META,
    sha256Url: WINDOWS_SHA256_URL,
  },
};

const ORDER: readonly DownloadBuild[] = ["mac", "mac-intel", "windows"];

/**
 * One filled button for the visitor's own computer, the other builds as a quiet row. Phones can't run
 * the desktop app, so they get no file at all (the card offers the emailed link instead).
 */
export function downloadChoice(device: VisitorDevice, intelMac: boolean): { primary: DownloadBuild | null; others: DownloadBuild[] } {
  if (device === "phone") return { primary: null, others: [] };
  const primary: DownloadBuild = device === "windows" ? "windows" : intelMac ? "mac-intel" : "mac";
  return { primary, others: ORDER.filter((build) => build !== primary) };
}
