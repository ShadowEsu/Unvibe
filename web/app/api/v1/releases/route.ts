export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = 'https://api.github.com/repos/ShadowEsu/Unvibe/releases?per_page=8';
const RELEASES = 'https://github.com/ShadowEsu/Unvibe/releases/';

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

/**
 * The parsed address (`href`) of `raw` when it is release `tag`'s page (`releases/tag/<tag>`) or a
 * file directly in its download folder (`releases/download/<tag>/<file>`), else null. Parsed,
 * because that is what the app opens; bound to the tag, so a list can't put an older build under a
 * newer tag.
 */
function releaseUrl(raw: unknown, tag: string, kind: 'tag' | 'download'): string | null {
  if (typeof raw !== 'string') return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!url.href.startsWith(RELEASES) || url.search || url.hash) return null;
  // ['', 'ShadowEsu', 'Unvibe', 'releases', kind, <tag>] plus <file> for a download.
  const parts = url.pathname.split('/');
  const shape = kind === 'tag' ? parts.length === 6 : parts.length === 7 && parts[6] !== '';
  if (!shape || parts[4] !== kind) return null;
  try {
    return decodeURIComponent(parts[5]) === tag ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Only the fields the desktop updater reads. A release whose page isn't its own tag's page is
 * dropped, and so is any asset outside its own release's download folder.
 */
export function trimReleases(body: unknown): FeedRelease[] | null {
  if (!Array.isArray(body)) return null;
  const releases: FeedRelease[] = [];
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    const { tag_name, draft, html_url, assets } = item as Record<string, unknown>;
    if (typeof tag_name !== 'string' || typeof draft !== 'boolean' || !Array.isArray(assets)) continue;
    const page = releaseUrl(html_url, tag_name, 'tag');
    if (!page) continue;
    const kept: FeedAsset[] = [];
    for (const asset of assets) {
      if (!asset || typeof asset !== 'object') continue;
      const { name, browser_download_url } = asset as Record<string, unknown>;
      const url = releaseUrl(browser_download_url, tag_name, 'download');
      if (typeof name === 'string' && url) kept.push({ name, browser_download_url: url });
    }
    releases.push({ tag_name, draft, html_url: page, assets: kept });
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
