export const BETA_RELEASE = "0.1.10-beta-usage";

export const FALLBACK_BETA_MAC_DOWNLOAD_URL =
  "https://github.com/ShadowEsu/Unvibe/releases/download/v0.1.10-beta-usage/Unvibe-0.1.10-usage-meters-arm64-unsigned.dmg";

/** Server-side source of truth shared by the waitlist and direct beta download flows. */
export function betaMacDownloadUrl(): string {
  return process.env.NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL?.trim()
    || process.env.NEXT_PUBLIC_INVESTOR_DMG_URL?.trim()
    || FALLBACK_BETA_MAC_DOWNLOAD_URL;
}
