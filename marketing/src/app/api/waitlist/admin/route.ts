import { NextResponse } from "next/server";
import { isWaitlistAdminAuthorized } from "@/lib/adminAuth";
import { listWaitlistEntries } from "@/lib/waitlistStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}

function tooManyFailedAttempts(ip: string): boolean {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= 10;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || entry.resetAt < now) failedAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
  else entry.count += 1;
}

export async function GET(request: Request) {
  const ip = clientIp(request);
  if (tooManyFailedAttempts(ip)) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
    );
  }
  if (!isWaitlistAdminAuthorized(request.headers.get("authorization"))) {
    recordFailedAttempt(ip);
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
    );
  }

  try {
    const entries = await listWaitlistEntries();
    return NextResponse.json(
      { entries, total: entries.length, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } }
    );
  } catch (error) {
    console.error("waitlist admin list failed", error);
    return NextResponse.json(
      { error: "Could not load waitlist" },
      { status: 500, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
    );
  }
}
