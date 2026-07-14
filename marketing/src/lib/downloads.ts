export type DownloadPlatform = "mac" | "windows";

export const DOWNLOAD_VERSION = "1.0.0";

/**
 * Installer URLs served from the marketing site CDN path.
 * Tracked entrypoint is /api/download?platform=… which records then redirects here.
 */
export const DOWNLOAD_ASSETS: Record<
  DownloadPlatform,
  { label: string; file: string; href: string; hint: string; arch: string }
> = {
  mac: {
    label: "macOS",
    file: "Unvibe-1.0.0-arm64.dmg",
    href: "/downloads/Unvibe-1.0.0-arm64.dmg",
    hint: "Drag Unvibe into Applications",
    arch: "Apple Silicon",
  },
  windows: {
    label: "Windows",
    file: "Unvibe-Setup-1.0.0.exe",
    href: "/downloads/Unvibe-Setup-1.0.0.exe",
    hint: "Run the installer · free forever",
    arch: "Windows x64",
  },
};

export function trackedDownloadPath(platform: DownloadPlatform): string {
  return `/api/download?platform=${platform}`;
}
