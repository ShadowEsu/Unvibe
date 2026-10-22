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

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "local";
}

/** 429 when limited, 503 when the shared limiter cannot be reached; null when allowed. */
export function rateLimitRejection(decision: RateLimitDecision, limitedMessage: string): NextResponse | null {
  if (decision === "allowed") return null;
  if (decision === "limited") return NextResponse.json({ error: limitedMessage }, { status: 429 });
  return NextResponse.json({ error: "Signups are paused for a moment. Try again shortly." }, { status: 503 });
}
