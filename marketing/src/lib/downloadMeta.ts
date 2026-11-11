import { BETA_INSTALL_TAG } from "@/lib/betaInstallScript";

/**
 * What each download is, in words, for the download card and the pages that describe a download
 * (Design W10, W11, W14). Byte sizes are the v0.1.51 release assets (draft release 439951947, `gh api
 * repos/ShadowEsu/Unvibe/releases/439951947`, 9 Nov). The Windows file the site links is the portable .exe
 * (Unvibe-0.1.51-win-x64-portable.exe): one file that runs from wherever it is saved, no installer.
 * Update the sizes with the tag; downloadMeta.test.ts fails if the tag moves without them.
 */
export const DOWNLOAD_SIZES = {
  tag: "v0.1.51",
  macArm64DmgBytes: 108_426_599,
  macX64DmgBytes: 115_588_960,
  windowsPortableExeBytes: 87_360_314,
} as const;

const VERSION = BETA_INSTALL_TAG.replace(/^v/, "");

/** Rounded up to whole megabytes (10^6 bytes), so "about" never undersells the download. */
const aboutMb = (bytes: number) => `about ${Math.ceil(bytes / 1_000_000)} MB`;

export const MAC_META = `Apple silicon. Version ${VERSION}, ${aboutMb(DOWNLOAD_SIZES.macArm64DmgBytes)}.`;
export const MAC_INTEL_META = `Intel Mac. Version ${VERSION}, ${aboutMb(DOWNLOAD_SIZES.macX64DmgBytes)}.`;
export const WINDOWS_META = `Windows 10 or 11, x64. Portable app, version ${VERSION}, ${aboutMb(DOWNLOAD_SIZES.windowsPortableExeBytes)}.`;

const RELEASE = `https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}`;
/** The release's SHA-256 checksum files: the Mac one covers both .dmg files, the Windows one the .exe. */
export const MAC_SHA256_URL = `${RELEASE}/SHA256SUMS-mac.txt`;
export const WINDOWS_SHA256_URL = `${RELEASE}/SHA256SUMS-windows.txt`;
