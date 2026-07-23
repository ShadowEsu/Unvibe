import { NextResponse } from "next/server";
import { isWaitlistAdminAuthorized, waitlistAdminOpenAccess } from "@/lib/adminAuth";
import { notifyFounder } from "@/lib/notifyWaitlist";
import {
  deleteWaitlistEntry,
  listWaitlistEntries,
  recordWaitlistNotification,
} from "@/lib/waitlistStore";

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
      {
        entries,
        total: entries.length,
        generatedAt: new Date().toISOString(),
        openAccess: waitlistAdminOpenAccess(),
      },
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

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (tooManyFailedAttempts(ip)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  if (!isWaitlistAdminAuthorized(request.headers.get("authorization"))) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  if (typeof body?.email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 422 });
  }

  try {
    const entry = (await listWaitlistEntries()).find((item) => item.email === body.email);
    if (!entry) return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    const notification = await notifyFounder({ ...entry, duplicate: false });
    await recordWaitlistNotification(entry.email, notification);
    return NextResponse.json(
      { notification },
      { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } }
    );
  } catch (error) {
    console.error("waitlist notification retry failed", error);
    return NextResponse.json({ error: "Could not retry notification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const ip = clientIp(request);
  if (tooManyFailedAttempts(ip)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  if (!isWaitlistAdminAuthorized(request.headers.get("authorization"))) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  if (typeof body?.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 422 });
  }

  try {
    const deleted = await deleteWaitlistEntry(body.email);
    if (!deleted) return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    return NextResponse.json(
      { deleted: true, email: body.email.trim().toLowerCase() },
      { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } }
    );
  } catch (error) {
    console.error("waitlist delete failed", error);
    return NextResponse.json({ error: "Could not delete signup" }, { status: 500 });
  }
}
