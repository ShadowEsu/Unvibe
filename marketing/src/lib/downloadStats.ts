/** Installer download counts from GitHub release assets. Public data, no token needed. */
import { BETA_INSTALL_TAG } from "@/lib/betaInstallScript";

export interface DownloadStats {
  total: number;
  mac: number;
  windows: number;
  currentTag: string;
  currentMac: number;
  currentWindows: number;
  releases: Array<{ tag: string; publishedAt: string; mac: number; windows: number }>;
  source: "github" | "unavailable";
}

interface GithubAsset {
  name: string;
  download_count: number;
}

interface GithubRelease {
  tag_name: string;
  published_at: string | null;
  assets: GithubAsset[];
}

const RELEASES_URL = "https://api.github.com/repos/ShadowEsu/Unvibe/releases?per_page=100";

export function platformOf(name: string): "mac" | "windows" | null {
  if (name.endsWith(".sha256") || name.endsWith(".blockmap")) return null;
  if (/\.(dmg|zip)$/i.test(name)) return "mac";
  if (/\.exe$/i.test(name)) return "windows";
  return null;
}

export function summarizeReleases(releases: GithubRelease[], currentTag = BETA_INSTALL_TAG): DownloadStats {
  const rows = releases.map((release) => {
    let mac = 0;
    let windows = 0;
    for (const asset of release.assets) {
      const platform = platformOf(asset.name);
      if (platform === "mac") mac += asset.download_count;
      if (platform === "windows") windows += asset.download_count;
    }
    return { tag: release.tag_name, publishedAt: release.published_at ?? "", mac, windows };
  });
  const current = rows.find((row) => row.tag === currentTag);
  const mac = rows.reduce((sum, row) => sum + row.mac, 0);
  const windows = rows.reduce((sum, row) => sum + row.windows, 0);
  return {
    total: mac + windows,
    mac,
    windows,
    currentTag,
    currentMac: current?.mac ?? 0,
    currentWindows: current?.windows ?? 0,
    releases: rows.filter((row) => row.mac + row.windows > 0),
    source: "github",
  };
}

export async function getDownloadStats(): Promise<DownloadStats> {
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "unvibe-site" },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    return summarizeReleases((await response.json()) as GithubRelease[]);
  } catch (error) {
    console.error("download stats failed", error);
    return { total: 0, mac: 0, windows: 0, currentTag: BETA_INSTALL_TAG, currentMac: 0, currentWindows: 0, releases: [], source: "unavailable" };
  }
}
