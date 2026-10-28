// Content-Security-Policy for unvibe.site (Security C3, option C). Plain JS so next.config.mjs and
// the tests read the same strings.
//
// Enforced now: the four directives that can't break a page. Report-only: the strict policy
// without 'unsafe-inline', so violation reports show what enforcing it would block before any
// page depends on it. Reports go to /api/csp-report through both report-uri (Firefox, Safari) and
// report-to (Chrome).

/** The four directives every response enforces (unvibe.site and api.unvibe.site). */
export const ENFORCED_CSP = "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

/** Where violation reports go, for report-uri and the Reporting-Endpoints header. */
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_GROUP = "csp";

/** Analytics hosts, loaded only after Allow: the SDKs send events and load their replay recorders here. */
const ANALYTICS_SCRIPT_HOSTS = ["https://us-assets.i.posthog.com", "https://cdn.mxpnl.com"];
const ANALYTICS_CONNECT_HOSTS = ["https://us.i.posthog.com", "https://us-assets.i.posthog.com", "https://api-js.mixpanel.com"];

/** An env URL's origin, or nothing when it is unset or not a URL. */
function origin(url) {
  try {
    return url ? [new URL(url).origin] : [];
  } catch {
    return [];
  }
}

/**
 * The strict policy, report-only. `api` is the Unvibe API origin Try it and the sign-in pages call;
 * `supabase` the Supabase project the site's /activate signs in with.
 */
export function reportOnlyCsp({ api = "https://api.unvibe.site", supabase = "" } = {}) {
  const connect = ["'self'", ...origin(api), ...origin(supabase), ...ANALYTICS_CONNECT_HOSTS];
  return [
    "default-src 'self'",
    `script-src 'self' ${ANALYTICS_SCRIPT_HOSTS.join(" ")}`,
    `connect-src ${connect.join(" ")}`,
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
}

/** The Reporting-Endpoints header that names the report-to group. */
export const REPORTING_ENDPOINTS = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;
