import { NextResponse } from "next/server";
import { clientNetwork, rateLimitRejection, rejectCrossSitePost } from "@/lib/publicForm";
import { consumeRateLimit, type RateLimitRule } from "@/lib/rateLimit";
import { webAppBackendUrl } from "@/lib/webAppBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per client network, counted in the shared Supabase limiter. Generous on purpose: a hackathon
 * venue puts hundreds of people behind one address, and a code has 80 random bits, so guessing is
 * hopeless anyway. The API also limits each signed-in account.
 */
const REDEEM_IP_LIMIT: RateLimitRule = { name: "promo-redeem-ip", windowSeconds: 60, max: 60 };
const NO_STORE = { "Cache-Control": "no-store" };

/** /redeem's proxy to POST /api/v1/promo/redeem. Forwards only the access token and the code. */
export async function POST(request: Request) {
  const crossSite = rejectCrossSitePost(request);
  if (crossSite) return crossSite;
  const limited = rateLimitRejection(
    await consumeRateLimit(REDEEM_IP_LIMIT, clientNetwork(request)),
    "Too many tries. Wait a minute and try again.",
  );
  if (limited) return limited;
  const body: unknown = await request.json().catch(() => null);
  const fields = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const accessToken = typeof fields.accessToken === "string" ? fields.accessToken : "";
  const code = typeof fields.code === "string" ? fields.code.slice(0, 64) : "";
  try {
    const response = await fetch(`${webAppBackendUrl()}/api/v1/promo/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken, code }),
      cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
