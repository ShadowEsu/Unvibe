export type DownloadPlatform = "mac" | "windows";

export const DOWNLOAD_VERSION = "1.0.0";

/** Default public Blob URLs (override with NEXT_PUBLIC_*_DOWNLOAD_URL). */
const DEFAULT_MAC =
  "https://kgtnwm7mfrhop6vj.public.blob.vercel-storage.com/downloads/Unvibe-1.0.0-arm64.dmg";
const DEFAULT_WIN =
  "https://kgtnwm7mfrhop6vj.public.blob.vercel-storage.com/downloads/Unvibe-Setup-1.0.0.exe";

/**
 * Installer URLs. Hosted on Vercel Blob (GitHub Releases uploads fail on large
 * TLS from some networks). Override with:
 * NEXT_PUBLIC_MAC_DOWNLOAD_URL / NEXT_PUBLIC_WIN_DOWNLOAD_URL
 */
export const DOWNLOAD_ASSETS: Record<
  DownloadPlatform,
  { label: string; file: string; href: string; hint: string; arch: string }
> = {
  mac: {
    label: "macOS",
    file: "Unvibe-1.0.0-arm64.dmg",
    href: process.env.NEXT_PUBLIC_MAC_DOWNLOAD_URL || DEFAULT_MAC,
    hint: "Drag Unvibe into Applications",
    arch: "Apple Silicon",
  },
  windows: {
    label: "Windows",
    file: "Unvibe-Setup-1.0.0.exe",
    href: process.env.NEXT_PUBLIC_WIN_DOWNLOAD_URL || DEFAULT_WIN,
    hint: "Run the installer · free forever",
    arch: "Windows x64",
  },
};

export function trackedDownloadPath(platform: DownloadPlatform): string {
  return `/api/download?platform=${platform}`;
}
