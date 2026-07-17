import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { waitlistDetailsSchema, waitlistSchema } from "@/lib/waitlistSchema";
import { notifyFounder } from "@/lib/notifyWaitlist";
import { publicWaitlistFailure } from "@/lib/waitlistErrors";
import {
  recordWaitlistNotification,
  saveWaitlistEntry,
  updateWaitlistDetails,
  type WaitlistEntry,
} from "@/lib/waitlistStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, max: 8 };
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}

function referralCodeFor(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 8);
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export async function POST(req: Request) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const parsed = waitlistSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const referralCode = referralCodeFor(email);
  const entry: WaitlistEntry = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email,
    referredBy: parsed.data.referredBy || undefined,
    referralCode,
    utmSource: parsed.data.utmSource || undefined,
    utmMedium: parsed.data.utmMedium || undefined,
    utmCampaign: parsed.data.utmCampaign || undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    const stored = await saveWaitlistEntry(entry);
    if (!stored.duplicate) {
      const notification = await notifyFounder({ ...entry, duplicate: false });
      await recordWaitlistNotification(email, notification).catch((error) => {
        console.error("waitlist notification status write failed", error);
      });
    }
    return NextResponse.json({ duplicate: stored.duplicate, saved: true });
  } catch (error) {
    console.error("waitlist signup failed", error);
    const failure = publicWaitlistFailure(error);
    return NextResponse.json(failure, { status: failure.status });
  }
}

export async function PATCH(req: Request) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const parsed = waitlistDetailsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });

  try {
    const updated = await updateWaitlistDetails(parsed.data.email.toLowerCase(), {
      tool: parsed.data.tool,
      experience: parsed.data.experience,
      message: parsed.data.message,
    });
    if (!updated) return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("waitlist details update failed", error);
    return NextResponse.json({ error: "Could not save details" }, { status: 500 });
  }
}
