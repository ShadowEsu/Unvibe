import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { waitlistSchema } from "@/lib/waitlistSchema";
import { notifyFounder } from "@/lib/notifyWaitlist";
import { sendWelcomeEmail } from "@/lib/sendWelcomeEmail";
import { publicWaitlistFailure } from "@/lib/waitlistErrors";
import {
  recordWaitlistBetaEmail,
  recordWaitlistNotification,
  referralCodeForEmail,
  saveWaitlistEntry,
  type WaitlistEntry,
} from "@/lib/waitlistStore";
import { captureMixpanelServerEvent } from "@/lib/mixpanelServer";
import { captureServerEvent } from "@/lib/posthogServer";
import { isProbeWaitlistEmail } from "@/lib/waitlistProbes";
import { recordGrowthFunnelEvent } from "@/lib/growthFunnelStore";
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

const IP_LIMIT: RateLimitRule = { name: "waitlist-ip", windowSeconds: 60, max: 8 };
const TOO_MANY = "Too many requests. Please try again shortly.";

function referralCodeFor(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 8);
}

export async function POST(req: Request) {
  const crossSite = rejectCrossSitePost(req);
  if (crossSite) return crossSite;
  const network = clientNetwork(req);
  const ipLimited = rateLimitRejection(await consumeRateLimit(IP_LIMIT, network), TOO_MANY);
  if (ipLimited) return ipLimited;
  const ipDayLimited = rateLimitRejection(await consumeRateLimit(signupIpDailyRule(), network), DAILY_LIMIT_MESSAGE);
  if (ipDayLimited) return ipDayLimited;

  const parsed = waitlistSchema.safeParse(withNameDefaults(await req.json().catch(() => null)));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  if (isProbeWaitlistEmail(email, `${parsed.data.firstName} ${parsed.data.lastName}`)) {
    return NextResponse.json({ error: "That email cannot be added to the waitlist." }, { status: 422 });
  }
  const emailLimited = rateLimitRejection(await consumeRateLimit(SIGNUP_EMAIL_LIMIT, email), TOO_MANY);
  if (emailLimited) return emailLimited;
  const ceiling = emailCeilingRejection(await consumeRateLimit(signupEmailDailyCeiling(), GLOBAL_KEY));
  if (ceiling) return ceiling;
  const referralCode = referralCodeFor(email);
  const referralInput = parsed.data.referredBy?.trim();
  // Stored as the friend's code, for attribution only (it grants nothing). A typed email is
  // resolved to that waitlister's code when the list knows it.
  const referredBy = referralInput?.includes("@")
    ? (await referralCodeForEmail(referralInput).catch(() => undefined)) ?? referralInput.toLowerCase()
    : referralInput?.toLowerCase() || undefined;
  const promoCode = parsed.data.promoCode?.trim().toUpperCase();
  const entry: WaitlistEntry = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email,
    referredBy,
    // Keep every submitted code visible to the founder in admin/CSV. Eligibility
    // for a particular offer is evaluated later, rather than silently discarding
    // a code a waitlist member typed.
    promoCode: promoCode || undefined,
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
      const welcome = await sendWelcomeEmail({ email, referralCode });
      await recordWaitlistBetaEmail(email, {
        status: welcome.sent ? "sent" : "failed",
        at: new Date().toISOString(),
        messageId: welcome.messageId,
        error: welcome.error,
      }).catch((error) => console.error("welcome email status write failed", error));
    }
    // Counted only when this browser allowed analytics (Security U-L1); otherwise nothing about the
    // signup leaves for PostHog or Mixpanel, and the funnel doesn't record it.
    if (parsed.data.analytics) {
      const completionProps = {
        duplicate: stored.duplicate,
        storage: stored.storage,
        has_referral: Boolean(referredBy),
        has_utm: Boolean(entry.utmSource || entry.utmMedium || entry.utmCampaign),
      };
      // Await so Vercel does not freeze the isolate before the capture request leaves.
      await Promise.all([
        captureServerEvent("waitlist_completed", referralCode, completionProps),
        captureMixpanelServerEvent("waitlist_completed", referralCode, completionProps),
        recordGrowthFunnelEvent("waitlist_completed", referralCode),
      ]);
    }
    // The same answer whether or not the email was already listed, so this is no membership check.
    return NextResponse.json({ saved: true, referralCode });
  } catch (error) {
    console.error("waitlist signup failed", error);
    const failure = publicWaitlistFailure(error);
    return NextResponse.json(failure, { status: failure.status });
  }
}

/** Joining only needs an email; older clients may still send names. */
function withNameDefaults(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  return { firstName: "", lastName: "", ...(body as Record<string, unknown>) };
}
