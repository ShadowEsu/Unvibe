/**
 * CSP violation reports for /api/csp-report (Security C3, condition 4).
 *
 * Kept from each report: the directive, the blocked resource's origin (or the literal `inline` /
 * `eval`), and the page's path. Never the IP, user agent, cookies, script sample, full blocked URL,
 * query, fragment or referrer. Next's own inline scripts report on every page view, so reports are
 * counted per (directive, blocked, path) and logged as one line per key per minute, with a total
 * cap per minute and a count of what was dropped.
 */

export const CSP_REPORT_MAX_BYTES = 8 * 1024;
export const CSP_REPORT_TYPES = new Set(["application/csp-report", "application/reports+json"]);
const MAX_FIELD = 200;

export type CspViolation = { directive: string; blocked: string; path: string };

function capped(value: string): string {
  return value.slice(0, MAX_FIELD);
}

/** The blocked resource as an origin, or `inline`, `eval`, `data:`, `blob:`, or `other`. */
function blockedOrigin(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "inline" || value === "eval") return value;
  if (value.startsWith("data:")) return "data:";
  if (value.startsWith("blob:")) return "blob:";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? capped(url.origin) : "other";
  } catch {
    return "other";
  }
}

/**
 * The site's top-level page routes (every folder under src/app with a page, `api` aside). A test
 * keeps this equal to the folders, so a new page is logged by name and nothing else is.
 */
export const SITE_ROUTES: ReadonlySet<string> = new Set([
  "about", "account-deletion", "activate", "beta", "build", "code-explainer-mac",
  "code-explainer-windows", "data-controls", "explain", "founder", "install-help", "investors", "kit",
  "pricing", "privacy", "redeem", "releases", "resources", "rewards", "s", "terms", "waitlist",
]);

/**
 * The page's route shape only: no query, no fragment, and no values. The first segment is kept only
 * when it is one of the site's routes; every later segment (the /s/ stats key, an explain id, a
 * token) and any other first segment (a mistyped name on a 404) becomes `:param`, so nothing a
 * person typed or a credential in a URL reaches the logs (Security C3-M1).
 */
function pagePath(raw: unknown): string {
  let pathname: string;
  try {
    pathname = new URL(typeof raw === "string" ? raw : "").pathname;
  } catch {
    return "unknown";
  }
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  const [first, ...rest] = segments;
  const head = SITE_ROUTES.has(first) ? first : ":param";
  return `/${[head, ...rest.map(() => ":param")].join("/")}`;
}

/** The directive's name only (a `violated-directive` may carry its whole source list). */
function directiveName(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().split(/\s+/)[0] ?? "" : "";
  return /^[a-z-]{1,40}$/.test(value) ? value : "unknown";
}

function field(record: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (record[name] !== undefined) return record[name];
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * The violations in a report body: `{ "csp-report": {...} }` (report-uri) or an array of Reporting
 * API reports with `type: "csp-violation"` (report-to). Anything else gives none.
 */
export function violationsFrom(body: unknown, contentType: string): CspViolation[] {
  const reports =
    contentType === "application/reports+json"
      ? (Array.isArray(body) ? body : [])
          .map(asRecord)
          .filter((report) => report?.type === "csp-violation")
          .map((report) => asRecord(report?.body))
      : [asRecord(asRecord(body)?.["csp-report"])];
  return reports.slice(0, 20).flatMap((report) => {
    if (!report) return [];
    return [{
      directive: directiveName(field(report, "effectiveDirective", "effective-directive", "violated-directive")),
      blocked: blockedOrigin(field(report, "blockedURL", "blocked-uri")),
      path: pagePath(field(report, "documentURL", "document-uri")),
    }];
  });
}

/**
 * Counts violations per minute and logs one line per (directive, blocked, path), plus one line with
 * the number dropped over `limitPerMinute`. A minute's lines are written when the next minute's
 * first report arrives, or on `flush()`.
 */
export function createCspCollector({
  limitPerMinute = 60,
  log = (line: string) => console.info(line),
}: { limitPerMinute?: number; log?: (line: string) => void } = {}) {
  let minute = -1;
  let accepted = 0;
  let dropped = 0;
  const counts = new Map<string, number>();

  const flush = () => {
    if (minute < 0) return;
    const at = new Date(minute * 60_000).toISOString();
    counts.forEach((count, key) => {
      const [directive, blocked, path] = JSON.parse(key) as [string, string, string];
      log(`csp-report ${JSON.stringify({ minute: at, directive, blocked, path, count })}`);
    });
    if (dropped > 0) log(`csp-report ${JSON.stringify({ minute: at, dropped })}`);
    counts.clear();
    accepted = 0;
    dropped = 0;
  };

  return {
    add(violations: CspViolation[], now = Date.now()) {
      const current = Math.floor(now / 60_000);
      if (current !== minute) {
        flush();
        minute = current;
      }
      for (const v of violations) {
        if (accepted >= limitPerMinute) {
          dropped += 1;
          continue;
        }
        accepted += 1;
        const key = JSON.stringify([v.directive, v.blocked, v.path]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    },
    flush,
  };
}

/** The request body as text, or null once it passes `max` bytes (read in chunks, never whole). */
export async function readCappedBody(req: Request, max = CSP_REPORT_MAX_BYTES): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
