/**
 * Page loads per Pacific day, by the utm_source of the link that brought them (E1 PR-C; Security file
 * requests/security/20261105-2342-unvibe-e1-counters-consent.md). Counted server-side in the middleware on
 * the document request the browser makes anyway, so it needs no consent: nothing is read from or written
 * to the device, no ID, IP address, user agent, referrer, path or time is stored or logged, and only
 * utm_source is read. Edge-safe: no Node imports.
 */

/**
 * The utm_source values counted by name (migration 0013 seeds the same list into site_load_sources, and
 * a test keeps the two equal). Marketing's UTM dictionary (agents/unvibe-marketing/utm-dictionary.md),
 * the launch sites from site/first-party-channels, and first100's listing sites. Never a per-person value.
 */
export const SITE_LOAD_SOURCES = [
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "threads",
  "linkedin",
  "github",
  "slack",
  "devpost",
  "outreach",
  "consoledev",
  "reddit",
  "hackernews",
  "peerpush",
  "sideprojectors",
  "launchingnext",
  "tinylaunch",
  "startupfame",
  "fazier",
  "futuretools",
  "saashub",
  "uneed",
  "startupbase",
  "devhunt",
  "whatlaunchedtoday",
  "aidirectorysite",
  "aier",
  "aisotools",
  "aitoolboard",
  "cloudfindr",
  "devsuite",
  "dodoindex",
  "findtools",
  "oksaas",
  "phyco",
  "saaspage",
  "scriptbyai",
  "superaitools",
  "therundown",
  "todaylaunches",
  "trylaunch",
  "visalytica",
] as const;

type KnownSource = (typeof SITE_LOAD_SOURCES)[number];

/** A load with no utm_source is "none"; one whose utm_source isn't on the list is "other". */
export type SiteLoadSource = KnownSource | "none" | "other";

const UTM_MAX = 40;
const KNOWN_SOURCES: readonly string[] = SITE_LOAD_SOURCES;

function isKnownSource(value: string): value is KnownSource {
  return KNOWN_SOURCES.includes(value);
}

/** The counted source for a page address's query string. Only utm_source is read. */
export function siteLoadSource(search: URLSearchParams): SiteLoadSource {
  const raw = search.get("utm_source")?.trim().toLowerCase() ?? "";
  if (!raw) return "none";
  return raw.length <= UTM_MAX && isKnownSource(raw) ? raw : "other";
}

/**
 * Pages that are never counted: the same private pages that start no analytics (PRIVATE_PATH in
 * analyticsPrivacy.ts: admin, waitlist admin, private stats links /s/<key>, sign-in and redeem), plus /stats.
 */
const SKIPPED_PATH = /^\/(?:console|stats|waitlist|waitlist-admin|s|activate|redeem)(?:[/.]|$)/i;

/**
 * Crawlers, link unfurlers, monitors and headless browsers, checked in memory only and never stored.
 * `bot` skips CUBOT phones' model name.
 */
const BOT_UA =
  /(?<!cu)bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\/|okhttp|httpclient|playwright|puppeteer|selenium|phantom/i;

export interface DocumentRequest {
  method: string;
  pathname: string;
  search: URLSearchParams;
  header: (name: string) => string | null;
}

/**
 * Whether this request is a page load to count: a GET for an HTML document from a browser, not a
 * prefetch or client-side navigation, not our own `?notrack=1` visit, not a bot, not a skipped page.
 */
export function isCountedLoad(req: DocumentRequest): boolean {
  if (req.method !== "GET") return false;
  if (SKIPPED_PATH.test(req.pathname)) return false;
  if (req.search.get("notrack") === "1") return false;
  const dest = req.header("sec-fetch-dest");
  if (dest !== null && dest !== "document") return false;
  if (!(req.header("accept") ?? "").includes("text/html")) return false;
  if (req.header("rsc") !== null || req.header("next-router-prefetch") !== null) return false;
  const purpose = req.header("purpose") ?? req.header("sec-purpose") ?? "";
  if (purpose.includes("prefetch")) return false;
  const ua = req.header("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return false;
  return true;
}

/**
 * Calendar day key in Pacific time (YYYY-MM-DD). The same day as `dayKey()` in siteStatsStore (a test
 * checks it), kept here because that module imports Node APIs the edge middleware can't load.
 */
export function siteLoadDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Posts one increment. Injected in tests; in production a PostgREST RPC call with the service role. */
export type SiteLoadPost = (day: string, source: SiteLoadSource) => Promise<boolean>;

function usableEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "[SENSITIVE]" || trimmed.toLowerCase() === "sensitive") return undefined;
  return trimmed;
}

/** The service-role RPC call (`record_site_load`, migration 0013), or null when storage isn't configured. */
export function supabaseSiteLoadPost(): SiteLoadPost | null {
  const url = usableEnv(process.env.SUPABASE_URL);
  const key = usableEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) return null;
  return async (day, source) => {
    const res = await fetch(`${url}/rest/v1/rpc/record_site_load`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_day: day, p_source: source }),
      cache: "no-store",
    });
    return res.ok;
  };
}

/**
 * Count one page load. Never throws; logs only a fixed string (Security E1-4). Runs inside
 * `event.waitUntil`, after the response is on its way, so it never delays or changes the page.
 */
export async function recordSiteLoad(
  source: SiteLoadSource,
  post: SiteLoadPost | null = supabaseSiteLoadPost(),
  now = new Date(),
): Promise<boolean> {
  if (!post) return false;
  try {
    if (await post(siteLoadDay(now), source)) return true;
  } catch {
    // Fall through to the fixed log line.
  }
  console.error("site load count failed");
  return false;
}
