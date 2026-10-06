import { WELCOME_SUBJECT, welcomeHtml, welcomeText } from "@/emails/welcome";
import { feedbackRewardUrl, siteOrigin } from "@/lib/rewardLink";

/** Sends the welcome email through Resend. Never throws; the caller records the outcome. */
export async function sendWelcomeEmail(input: {
  email: string;
  referralCode: string;
  downloadUrl?: string;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, error: "Email delivery is not configured." };
  const from = process.env.WAITLIST_FROM_EMAIL?.trim() || "Unvibe <onboarding@resend.dev>";
  const content = {
    email: input.email,
    referralCode: input.referralCode,
    downloadUrl: input.downloadUrl,
    feedbackUrl: feedbackRewardUrl(input.email),
    siteUrl: siteOrigin(),
  };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `unvibe-welcome-${input.referralCode.toLowerCase()}`,
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        reply_to: "preston@unvibe.site",
        subject: WELCOME_SUBJECT,
        html: welcomeHtml(content),
        text: welcomeText(content),
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
