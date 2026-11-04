export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = 'https://api.github.com/repos/ShadowEsu/Unvibe/releases?per_page=8';
const ASSET_HOST = /^https:\/\/github\.com\/ShadowEsu\/Unvibe\/releases\/download\//;

export interface FeedAsset {
  name: string;
  browser_download_url: string;
}

export interface FeedRelease {
  tag_name: string;
  draft: boolean;
  html_url: string;
  assets: FeedAsset[];
}

/** The parsed address (`href`) is what the app fetches, so that is what must stay in this repository's releases. */
function releaseAssetUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let href: string;
  try {
    href = new URL(raw).href;
  } catch {
    return null;
  }
  return ASSET_HOST.test(href) ? href : null;
}

/** Only the fields the desktop updater reads; any asset outside this repository's releases is dropped. */
export function trimReleases(body: unknown): FeedRelease[] | null {
  if (!Array.isArray(body)) return null;
  const releases: FeedRelease[] = [];
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    const { tag_name, draft, html_url, assets } = item as Record<string, unknown>;
    if (typeof tag_name !== 'string' || typeof draft !== 'boolean' || typeof html_url !== 'string' || !Array.isArray(assets)) continue;
    const kept: FeedAsset[] = [];
    for (const asset of assets) {
      if (!asset || typeof asset !== 'object') continue;
      const { name, browser_download_url } = asset as Record<string, unknown>;
      const url = releaseAssetUrl(browser_download_url);
      if (typeof name === 'string' && url) kept.push({ name, browser_download_url: url });
    }
    releases.push({ tag_name, draft, html_url, assets: kept });
  }
  return releases;
}

function upstreamFailed(): Response {
  return Response.json({ error: 'release_feed_unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } });
}

/**
 * Public: the desktop app's update feed. GitHub allows 60 unauthenticated requests an hour per IP,
 * so apps behind one school or office address ran out; this serves the same list from the CDN for
 * everyone. No token, no secrets. A failed upstream answer is a 502 that is never cached, never an
 * empty list (which the app would read as "no update").
 */
export async function GET(): Promise<Response> {
  let body: unknown;
  try {
    const res = await fetch(UPSTREAM, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'unvibe-api' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return upstreamFailed();
    body = await res.json();
  } catch {
    return upstreamFailed();
  }
  const releases = trimReleases(body);
  if (!releases) return upstreamFailed();
  return Response.json(releases, { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
