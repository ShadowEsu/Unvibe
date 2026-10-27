import { WELCOME_SUBJECT, welcomeHtml, welcomeText } from "@/emails/welcome";
import { feedbackRewardUrl, siteOrigin } from "@/lib/rewardLink";
import { unsubscribeHeaders, unsubscribeUrl } from "@/lib/unsubscribe";
import { isEmailUnsubscribed } from "@/lib/waitlistStore";

/**
 * Sends the welcome email through Resend. Never throws; the caller records the outcome.
 * Skips addresses that unsubscribed, so a repeat download never emails them again.
 */
export async function sendWelcomeEmail(input: {
  email: string;
  referralCode: string;
  downloadUrl?: string;
  /** The app release a download email links. It is part of the send key, so a later release's email is not refused as a repeat. */
  release?: string;
  /** The caller schedules a setup reminder after this, so the footer says so. */
  setupTipFollows?: boolean;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, error: "Email delivery is not configured." };
  if (await isEmailUnsubscribed(input.email)) return { sent: false, error: "This address unsubscribed." };
  const from = process.env.WAITLIST_FROM_EMAIL?.trim() || "Unvibe <onboarding@resend.dev>";
  const content = {
    email: input.email,
    referralCode: input.referralCode,
    downloadUrl: input.downloadUrl,
    feedbackUrl: feedbackRewardUrl(input.email),
    unsubscribeUrl: unsubscribeUrl(input.email),
    setupTipFollows: input.setupTipFollows,
    siteUrl: siteOrigin(),
  };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `unvibe-welcome-${input.release ? `${input.release}-` : ""}${input.referralCode.toLowerCase()}`,
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        reply_to: "support@unvibe.site",
        subject: WELCOME_SUBJECT,
        html: welcomeHtml(content),
        text: welcomeText(content),
        headers: unsubscribeHeaders(input.email),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) return { sent: false, error: data.message || `Email delivery failed (${response.status}).` };
    return { sent: true, messageId: data.id };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Email delivery failed." };
  }
}
