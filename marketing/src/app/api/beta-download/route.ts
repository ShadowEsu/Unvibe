import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findBetaDownload, saveBetaDownload, type BetaDownloadEntry } from "@/lib/betaDownloadStore";
import { scheduleSetupReminder, sendBetaDownloadEmail } from "@/lib/sendBetaDownloadEmail";
import { saveWaitlistEntry } from "@/lib/waitlistStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const release = "0.1.26";
const fallbackMacDownload = "https://github.com/ShadowEsu/Unvibe/releases/download/v0.1.26/Unvibe-0.1.26-mac-arm64.dmg";
const schema = z.object({
  firstName: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().email().max(240),
  // A friend's 8 character code from their ?ref= link. The database grants both people Pro.
  referredBy: z.string().trim().toLowerCase().regex(/^([a-f0-9]{8})?$/).optional().default(""),
});

const RATE_LIMIT = { windowMs: 60_000, max: 6 };
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}

function referralCode(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 8).toUpperCase();
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many download requests. Try again shortly." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 422 });

  const email = parsed.data.email.toLowerCase();
  const macDownloadUrl = process.env.NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL?.trim()
    || process.env.NEXT_PUBLIC_INVESTOR_DMG_URL?.trim()
    || fallbackMacDownload;
  const existing = await findBetaDownload(email, release).catch(() => null);
  const code = existing?.referralCode || referralCode(email);
  const delivery = existing?.emailSentAt
    ? { sent: true, messageId: existing.emailMessageId }
    : await sendBetaDownloadEmail({ firstName: parsed.data.firstName, email, macDownloadUrl, referralCode: code });
  if (!existing?.emailSentAt && delivery.sent) await scheduleSetupReminder(email, code).catch(() => undefined);

  const entry: BetaDownloadEntry = {
    firstName: parsed.data.firstName,
    email,
    platform: "mac",
    release,
    referralCode: code,
    createdAt: existing?.createdAt || new Date().toISOString(),
    emailSentAt: existing?.emailSentAt || (delivery.sent ? new Date().toISOString() : undefined),
    emailMessageId: existing?.emailMessageId || delivery.messageId,
  };
  await saveBetaDownload(entry).catch((error) => console.error("beta download record failed", error));
  // Everyone who downloads is on the waitlist too. A new row with a referral claims it.
  await saveWaitlistEntry({
    firstName: parsed.data.firstName,
    lastName: "",
    email,
    referralCode: code.toLowerCase(),
    referredBy: parsed.data.referredBy || undefined,
    utmSource: "download",
    createdAt: new Date().toISOString(),
  }).catch((error) => console.error("download waitlist record failed", error));

  return NextResponse.json({
    downloadUrl: macDownloadUrl,
    emailSent: delivery.sent,
    referralCode: code,
    emailNotice: delivery.sent ? "Download and feedback links sent to your inbox." : "Your download is ready. Email delivery is temporarily unavailable.",
  }, { headers: { "Cache-Control": "no-store" } });
}
