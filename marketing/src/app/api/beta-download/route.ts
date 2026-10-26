import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findBetaDownload, saveBetaDownload, type BetaDownloadEntry } from "@/lib/betaDownloadStore";
import { scheduleSetupReminder } from "@/lib/sendBetaDownloadEmail";
import { sendWelcomeEmail } from "@/lib/sendWelcomeEmail";
import { recordWaitlistBetaEmail, saveWaitlistEntry } from "@/lib/waitlistStore";
import { clientNetwork, DAILY_LIMIT_MESSAGE, emailCeilingRejection, rateLimitRejection, rejectCrossSitePost } from "@/lib/publicForm";
import {
  consumeRateLimit,
  GLOBAL_KEY,
  SIGNUP_EMAIL_LIMIT,
  signupEmailDailyCeiling,
  signupIpDailyRule,
  type RateLimitRule,
} from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const release = "0.1.44";
const fallbackMacDownload = "https://github.com/ShadowEsu/Unvibe/releases/download/v0.1.44/Unvibe-0.1.44-mac-arm64.dmg";
const schema = z.object({
  firstName: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().email().max(240),
  // The friend's code from their ?ref= link (app gift code or legacy waitlist code). Kept for
  // attribution only: Pro months come from entering the gift code in the signed-in app.
  referredBy: z.string().trim().regex(/^([a-f0-9]{8}|[A-Za-z0-9_-]{16})?$/).optional().default(""),
});

const IP_LIMIT: RateLimitRule = { name: "beta-download-ip", windowSeconds: 60, max: 6 };
const TOO_MANY = "Too many download requests. Try again shortly.";

function referralCode(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 8).toUpperCase();
}

export async function POST(request: Request) {
  const crossSite = rejectCrossSitePost(request);
  if (crossSite) return crossSite;
  const network = clientNetwork(request);
  const ipLimited = rateLimitRejection(await consumeRateLimit(IP_LIMIT, network), TOO_MANY);
  if (ipLimited) return ipLimited;
  const ipDayLimited = rateLimitRejection(await consumeRateLimit(signupIpDailyRule(), network), DAILY_LIMIT_MESSAGE);
  if (ipDayLimited) return ipDayLimited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 422 });

  const email = parsed.data.email.toLowerCase();
  // Hidden founder metric rows live on the waitlist under this domain.
  if (email.endsWith("@unvibe.internal")) return NextResponse.json({ error: "Enter a valid email." }, { status: 422 });
  const emailLimited = rateLimitRejection(await consumeRateLimit(SIGNUP_EMAIL_LIMIT, email), TOO_MANY);
  if (emailLimited) return emailLimited;
  const ceiling = emailCeilingRejection(await consumeRateLimit(signupEmailDailyCeiling(), GLOBAL_KEY));
  if (ceiling) return ceiling;
  const macDownloadUrl = process.env.NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL?.trim()
    || process.env.NEXT_PUBLIC_INVESTOR_DMG_URL?.trim()
    || fallbackMacDownload;
  const existing = await findBetaDownload(email, release).catch(() => null);
  const code = existing?.referralCode || referralCode(email);
  const delivery = existing?.emailSentAt
    ? { sent: true, messageId: existing.emailMessageId }
    : await sendWelcomeEmail({ email, referralCode: code.toLowerCase(), downloadUrl: macDownloadUrl, setupTipFollows: true });
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
  // Everyone who downloads is on the waitlist too. referred_by is attribution only; it grants nothing.
  await saveWaitlistEntry({
    firstName: parsed.data.firstName,
    lastName: "",
    email,
    referralCode: code.toLowerCase(),
    referredBy: parsed.data.referredBy || undefined,
    utmSource: "download",
    createdAt: new Date().toISOString(),
  }).catch((error) => console.error("download waitlist record failed", error));
  if (!existing?.emailSentAt) {
    await recordWaitlistBetaEmail(email, {
      status: delivery.sent ? "sent" : "failed",
      at: new Date().toISOString(),
      messageId: delivery.messageId,
      error: "error" in delivery ? delivery.error : undefined,
    }).catch(() => undefined);
  }

  return NextResponse.json({
    downloadUrl: macDownloadUrl,
    emailSent: delivery.sent,
    referralCode: code,
    emailNotice: delivery.sent ? "Download and feedback links sent to your inbox." : "Your download is ready. Email delivery is temporarily unavailable.",
  }, { headers: { "Cache-Control": "no-store" } });
}
