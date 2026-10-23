import { isIPv6 } from "node:net";
import { NextResponse } from "next/server";
import type { RateLimitDecision } from "@/lib/rateLimit";

/**
 * Guards for the public signup forms (waitlist, beta download). Both send email to the
 * submitted address, so only unvibe.site's own pages may post them, as JSON: a browser on
 * another site cannot send that cross-origin without a CORS preflight we never answer.
 */

const SITE_ORIGINS = ["https://unvibe.site", "https://www.unvibe.site"];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

function allowedOrigin(origin: string): boolean {
  if (SITE_ORIGINS.includes(origin)) return true;
  if (process.env.VERCEL_ENV === "production") return false;
  // Vercel preview deployments and local development.
  const previews = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .map((host) => host?.trim())
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
  return previews.includes(origin) || LOCAL_ORIGIN.test(origin);
}

/** 403 for a missing or foreign Origin, 415 for a non-JSON body; null when the post may proceed. */
export function rejectCrossSitePost(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigin(origin)) {
    return NextResponse.json({ error: "This form only works on unvibe.site." }, { status: 403 });
  }
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return NextResponse.json({ error: "Send the form as JSON." }, { status: 415 });
  }
  return null;
}

/**
 * The unit the per-IP limits count, mirroring web `trialAccess.ts` `ipNetwork`. IPv4 is used as
 * is. IPv6 is grouped by its /64, because one host usually holds a whole /64 and could otherwise
 * rotate addresses past the limit. IPv4-mapped IPv6 (`::ffff:a.b.c.d`) counts as the IPv4.
 * Anything unparseable (e.g. `local`) is used as is.
 */
function ipNetwork(raw: string): string {
  const ip = raw.trim().replace(/^\[(.*)\]$/, "$1").replace(/%.*$/, "").toLowerCase();
  if (!isIPv6(ip)) return ip;
  // Hextets of one side of `::`; a trailing dotted quad is the last two hextets.
  const hextets = (part: string): number[] => (part ? part.split(":") : []).flatMap((group) => {
    if (!group.includes(".")) return [parseInt(group, 16)];
    const [a = 0, b = 0, c = 0, d = 0] = group.split(".").map(Number);
    return [(a << 8) | b, (c << 8) | d];
  });
  const gap = ip.indexOf("::");
  const left = hextets(gap === -1 ? ip : ip.slice(0, gap));
  const right = gap === -1 ? [] : hextets(ip.slice(gap + 2));
  const groups = [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const [high = 0, low = 0] = groups.slice(6);
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  }
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(":")}::/64`;
}

/** The caller's network for the per-IP limits: the forwarded client address, IPv6 as its /64. */
export function clientNetwork(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return ipNetwork(forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "local");
}

const LIMITER_UNAVAILABLE = "Signups are paused for a moment. Try again shortly.";
export const DAILY_LIMIT_MESSAGE = "Too many signups from this network today. Please try again tomorrow.";

/** 429 when limited, 503 when the shared limiter cannot be reached; null when allowed. */
export function rateLimitRejection(decision: RateLimitDecision, limitedMessage: string): NextResponse | null {
  if (decision === "allowed") return null;
  if (decision === "limited") return NextResponse.json({ error: limitedMessage }, { status: 429 });
  return NextResponse.json({ error: LIMITER_UNAVAILABLE }, { status: 503 });
}

/** The site-wide daily email ceiling: a plain 503 for everyone once it is reached; null when allowed. */
export function emailCeilingRejection(decision: RateLimitDecision): NextResponse | null {
  if (decision === "allowed") return null;
  if (decision === "unavailable") return NextResponse.json({ error: LIMITER_UNAVAILABLE }, { status: 503 });
  // The only alert today: a Vercel log line to search for.
  console.error("signup email daily ceiling reached (SIGNUP_EMAIL_DAILY_CEILING)");
  return NextResponse.json(
    { error: "We have sent all the signup emails we can for today. Please try again tomorrow." },
    { status: 503 },
  );
}
