/**
 * Reads real desktop app releases straight from GitHub Releases so this page never
 * shows fabricated version history — it mirrors exactly what the app-release workflow
 * has actually published (see .github/workflows/app-release.yml).
 */

export const GITHUB_REPO = "ShadowEsu/Unvibe";

export interface ReleaseAsset {
  name: string;
  url: string;
  sizeBytes: number;
  downloadCount: number;
}

export interface ReleaseNote {
  tagName: string;
  name: string;
  publishedAt: string | null;
  body: string;
  htmlUrl: string;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export interface ReleasePlatformAssets {
  macArm64?: ReleaseAsset;
  macIntel?: ReleaseAsset;
  windowsInstaller?: ReleaseAsset;
  windowsPortable?: ReleaseAsset;
}

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
}

interface GithubRelease {
  tag_name: string;
  name: string | null;
  published_at: string | null;
  body: string | null;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  assets: GithubReleaseAsset[];
}

export async function fetchReleases(): Promise<{
  releases: ReleaseNote[];
  error: string | null;
}> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return { releases: [], error: `GitHub responded with ${res.status}` };
    }
    const data = (await res.json()) as GithubRelease[];
    const releases = data
      .filter((r) => !r.draft && r.tag_name.startsWith("app-v"))
      .map(toReleaseNote);
    return { releases, error: null };
  } catch {
    return { releases: [], error: "Could not reach GitHub" };
  }
}

function toReleaseNote(release: GithubRelease): ReleaseNote {
  return {
    tagName: release.tag_name,
    name: release.name || release.tag_name.replace(/^app-v/, "v"),
    publishedAt: release.published_at,
    body: release.body || "",
    htmlUrl: release.html_url,
    prerelease: release.prerelease,
    assets: release.assets.map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      sizeBytes: a.size,
      downloadCount: a.download_count,
    })),
  };
}

export function platformAssetsFor(release: ReleaseNote): ReleasePlatformAssets {
  const find = (predicate: (name: string) => boolean) =>
    release.assets.find((a) => predicate(a.name.toLowerCase()));
  return {
    macArm64: find((n) => n.includes("mac-arm64") && n.endsWith(".dmg")),
    macIntel: find((n) => n.includes("mac-x64") && n.endsWith(".dmg")),
    windowsInstaller: find((n) => n.includes("win-x64-setup") && n.endsWith(".exe")),
    windowsPortable: find((n) => n.includes("win-x64-portable") && n.endsWith(".exe")),
  };
}

/** Splits a GitHub release body into paragraph and bullet blocks for simple rendering. */
export function parseReleaseBody(body: string): Array<{ type: "bullet" | "text"; text: string }> {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const bullet = line.match(/^[-*]\s+(.*)$/);
      return bullet
        ? { type: "bullet" as const, text: bullet[1] }
        : { type: "text" as const, text: line };
    });
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}
