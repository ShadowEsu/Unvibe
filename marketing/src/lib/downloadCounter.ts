/**
 * Download clicks per Pacific day, by file and by the utm_source that brought the visitor (E1 PR-B; Security
 * gate 6 Nov: aggregate counts only, no cookie, storage, ID, IP or user agent kept, utm values from the
 * allowlist only). The site's download links go to /download/<file> (src/app/download/[file]/route.ts),
 * which adds 1 here and redirects to the GitHub release asset. Nothing is read from or written to the
 * device: the source comes from the link's own utm_source, or else from the utm_source in the address of
 * the unvibe.site page the click came from (the Referer the browser sends to our own origin). Neither
 * address is stored or logged.
 */
import {
  BETA_MAC_DOWNLOAD_URL,
  BETA_MAC_INTEL_DOWNLOAD_URL,
  BETA_WINDOWS_DOWNLOAD_URL,
} from "@/lib/betaInstallScript";
import { DOWNLOAD_FILE_NAMES, type DownloadFile } from "@/lib/downloadFiles";
import { isBotUserAgent, siteLoadDay, siteLoadSource, usableEnv, type SiteLoadSource } from "@/lib/siteLoads";

/**
 * The only files /download/<file> serves, each to this release's asset (BETA_INSTALL_TAG moves them all).
 * `file` is the address segment, `asset` the stored name (migration 0014's check list).
 */
export const DOWNLOAD_FILES: Record<DownloadFile, { asset: DownloadAsset; url: string }> = {
  mac: { asset: "mac", url: BETA_MAC_DOWNLOAD_URL },
  "mac-intel": { asset: "mac_intel", url: BETA_MAC_INTEL_DOWNLOAD_URL },
  windows: { asset: "windows", url: BETA_WINDOWS_DOWNLOAD_URL },
};

export type DownloadAsset = "mac" | "mac_intel" | "windows";

export function downloadFile(segment: string): DownloadFile | null {
  return (DOWNLOAD_FILE_NAMES as readonly string[]).includes(segment) ? (segment as DownloadFile) : null;
}

export interface DownloadRequest {
  method: string;
  search: URLSearchParams;
  header: (name: string) => string | null;
}

/**
 * The referring page's query string when it is one of our own pages (same host as this request, e.g.
 * unvibe.site or a preview deployment), else null. Read in memory only. The Host header is used rather than
 * the request URL, which `next start` reports as localhost.
 */
function ownReferrerSearch(req: DownloadRequest): URLSearchParams | null {
  const referer = req.header("referer");
  const host = (req.header("x-forwarded-host") ?? req.header("host"))?.split(",")[0].trim().toLowerCase();
  if (!referer || !host) return null;
  try {
    const from = new URL(referer);
    return from.host.toLowerCase() === host ? from.searchParams : null;
  } catch {
    return null;
  }
}

/**
 * Whether to count this request: a browser navigating to the link (a click sends `sec-fetch-dest: document`
 * even when the answer becomes a download). HEAD requests, link previews, crawlers, scripts, and other sites
 * embedding the address as an image or fetch still get the redirect but aren't counted, and neither is a
 * click from our own `?notrack=1` visit.
 */
export function isCountedDownload(req: DownloadRequest): boolean {
  if (req.method !== "GET") return false;
  if (req.search.get("notrack") === "1" || ownReferrerSearch(req)?.get("notrack") === "1") return false;
  const dest = req.header("sec-fetch-dest");
  if (dest !== null && dest !== "document") return false;
  const ua = req.header("user-agent") ?? "";
  if (!ua || isBotUserAgent(ua)) return false;
  const purpose = req.header("purpose") ?? req.header("sec-purpose") ?? "";
  return !purpose.includes("prefetch");
}

/** The link's own utm_source if it has one, else the referring unvibe.site page's, through the allowlist. */
export function downloadSource(req: DownloadRequest): SiteLoadSource {
  const own = siteLoadSource(req.search);
  if (own !== "none") return own;
  const from = ownReferrerSearch(req);
  return from ? siteLoadSource(from) : "none";
}

/** Posts one increment. Injected in tests; in production a PostgREST RPC call with the service role. */
export type DownloadPost = (day: string, asset: DownloadAsset, source: SiteLoadSource) => Promise<boolean>;

/** The service-role RPC call (`record_download`, migration 0014), or null when storage isn't configured. */
export function supabaseDownloadPost(): DownloadPost | null {
  const url = usableEnv(process.env.SUPABASE_URL);
  const key = usableEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) return null;
  return async (day, asset, source) => {
    const res = await fetch(`${url}/rest/v1/rpc/record_download`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_day: day, p_asset: asset, p_source: source }),
      cache: "no-store",
    });
    return res.ok;
  };
}

/** Longest a download redirect waits on the count, so a slow or broken store never holds up a download. */
export const DOWNLOAD_COUNT_WAIT_MS = 1000;

/** Count one download. Never throws, never waits longer than `waitMs`, logs only a fixed string (Security E1-4). */
export async function recordDownload(
  asset: DownloadAsset,
  source: SiteLoadSource,
  post: DownloadPost | null = supabaseDownloadPost(),
  now = new Date(),
  waitMs = DOWNLOAD_COUNT_WAIT_MS,
): Promise<boolean> {
  if (!post) return false;
  let stopTimer = () => {};
  const timedOut = new Promise<boolean>((resolve) => {
    const id = setTimeout(() => resolve(false), waitMs);
    stopTimer = () => clearTimeout(id);
  });
  const ok = await Promise.race([post(siteLoadDay(now), asset, source).catch(() => false), timedOut]);
  stopTimer();
  if (ok) return true;
  console.error("download count failed");
  return false;
}
