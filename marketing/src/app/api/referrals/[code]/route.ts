import { NextResponse } from "next/server";
import { referralProgress } from "@/lib/waitlistStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, max: 30 };
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const prior = hits.get(ip);
  if (!prior || prior.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  prior.count += 1;
  return prior.count > RATE_LIMIT.max;
}

export async function GET(request: Request, { params }: { params: { code: string } }) {
  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ error: "Please try again shortly." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const progress = await referralProgress(params.code);
    // An unknown code gets the same 200 and zero count. That alone is not the membership guard: one join with
    // `referredBy` set to a member's code makes the count ≥ 1. The guard is that codes are HMACs of a server secret
    // (lib/referralCode.ts), so nobody can compute someone else's code from their email.
    return NextResponse.json({ joinedReferrals: progress.joinedReferrals }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch (error) {
    console.error("referral progress lookup failed", error);
    return NextResponse.json({ error: "Could not load referral progress." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
