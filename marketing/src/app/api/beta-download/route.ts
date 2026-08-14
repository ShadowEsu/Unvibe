import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findBetaDownload, saveBetaDownload, type BetaDownloadEntry } from "@/lib/betaDownloadStore";
import { BETA_RELEASE, betaMacDownloadUrl } from "@/lib/betaRelease";
import { sendBetaDownloadEmail } from "@/lib/sendBetaDownloadEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(240),
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
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid first name and email." }, { status: 422 });

  const email = parsed.data.email.toLowerCase();
  const macDownloadUrl = betaMacDownloadUrl();
  const existing = await findBetaDownload(email, BETA_RELEASE).catch(() => null);
  const code = existing?.referralCode || referralCode(email);
  const delivery = existing?.emailSentAt
    ? { sent: true, messageId: existing.emailMessageId, error: undefined }
    : await sendBetaDownloadEmail({ firstName: parsed.data.firstName, email, macDownloadUrl, referralCode: code });
  if (!delivery.sent) console.error("beta download email delivery failed", delivery.error);

  const entry: BetaDownloadEntry = {
    firstName: parsed.data.firstName,
    email,
    platform: "mac",
    release: BETA_RELEASE,
    referralCode: code,
    createdAt: existing?.createdAt || new Date().toISOString(),
    emailSentAt: existing?.emailSentAt || (delivery.sent ? new Date().toISOString() : undefined),
    emailMessageId: existing?.emailMessageId || delivery.messageId,
  };
  await saveBetaDownload(entry).catch((error) => console.error("beta download record failed", error));

  return NextResponse.json({
    downloadUrl: macDownloadUrl,
    emailSent: delivery.sent,
    referralCode: code,
    emailNotice: delivery.sent ? "Download and feedback links sent to your inbox." : "Your download is ready. Email delivery is temporarily unavailable.",
  }, { headers: { "Cache-Control": "no-store" } });
}
