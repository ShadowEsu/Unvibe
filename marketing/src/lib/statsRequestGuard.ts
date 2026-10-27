/**
 * The counters behind /api/stats/hit and /api/stats/event take posts from this site's own pages only.
 * - A body that isn't `Content-Type: application/json` is refused (415). A browser sends JSON from
 *   another site only after a CORS preflight, which these routes never answer, so other sites'
 *   pages can't post a "simple" text/plain body that would still parse as JSON.
 * - `Sec-Fetch-Site` other than same-origin or same-site is refused (403). Browsers that don't send
 *   the header are let through.
 * Scripts outside a browser can still post; the counts are unauthenticated.
 */
export function statsRequestRefusal(req: Request): 403 | 415 | null {
  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "same-site") return 403;
  const mediaType = (req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") return 415;
  return null;
}
