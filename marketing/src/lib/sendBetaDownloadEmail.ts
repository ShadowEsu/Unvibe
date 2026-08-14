import { BETA_DOWNLOAD_SUBJECT, betaDownloadHtml, betaDownloadText } from "@/emails/betaDownload";

export async function sendBetaDownloadEmail(input: {
  firstName: string;
  email: string;
  macDownloadUrl: string;
  referralCode: string;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, error: "Beta email delivery is not configured." };
  const from = process.env.WAITLIST_FROM_EMAIL?.trim() || "Unvibe Beta <onboarding@resend.dev>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `unvibe-beta-download-${input.referralCode}`,
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        reply_to: "preston@unvibe.site",
        subject: BETA_DOWNLOAD_SUBJECT,
        html: betaDownloadHtml(input),
        text: betaDownloadText(input),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const data = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) return { sent: false, error: data.message || `Email delivery failed (${response.status}).` };
    return { sent: true, messageId: data.id };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "The email provider could not be reached.",
    };
  }
}
