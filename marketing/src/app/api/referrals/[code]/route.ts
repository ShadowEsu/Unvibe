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
    if (!progress.found) return NextResponse.json({ error: "Referral link not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const rewardsPendingReview = Math.min(Math.floor(progress.joinedReferrals / 3), 5);
    return NextResponse.json({
      joinedReferrals: progress.joinedReferrals,
      nextRewardAt: Math.min((rewardsPendingReview + 1) * 3, 15),
      rewardsPendingReview,
      rewardCap: 5,
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch (error) {
    console.error("referral progress lookup failed", error);
    return NextResponse.json({ error: "Could not load referral progress." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
