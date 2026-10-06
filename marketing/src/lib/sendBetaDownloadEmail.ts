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
}

/**
 * A friendly nudge a day after download, for the many people who install and forget.
 * Resend holds it and sends it later; nothing runs on our side in between.
 */
export async function scheduleSetupReminder(email: string, referralCode: string): Promise<{ scheduled: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { scheduled: false, error: "Email delivery is not configured." };
  const from = process.env.WAITLIST_FROM_EMAIL?.trim() || "Unvibe Beta <onboarding@resend.dev>";
  const text = [
    "Hi, it's Vibe from Unvibe.",
    "",
    "Your first explanation is waiting. Three steps:",
    "1. Open Unvibe (it lives in your Dock or taskbar).",
    "2. Select any code in Cursor, VS Code or Terminal.",
    "3. Press Command U on Mac or Ctrl U on Windows.",
    "",
    "That's it. I'll explain it right beside your editor.",
    "",
    "Reply to this email if anything gets in the way. A human reads every reply.",
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.55;color:#141414;max-width:520px">
<p><b>Hi, it's Vibe from Unvibe.</b></p>
<p>Your first explanation is waiting. Three steps:</p>
<ol><li>Open Unvibe (it lives in your Dock or taskbar).</li><li>Select any code in Cursor, VS Code or Terminal.</li><li>Press <b>Command U</b> on Mac or <b>Ctrl U</b> on Windows.</li></ol>
<p>That's it. I'll explain it right beside your editor.</p>
<p style="color:#66635d">Reply to this email if anything gets in the way. A human reads every reply.</p></div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `unvibe-setup-reminder-${referralCode}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      reply_to: "preston@unvibe.site",
      subject: "Your first Unvibe explanation is waiting",
      html,
      text,
      scheduled_at: "in 1 day",
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!response?.ok) return { scheduled: false, error: `Reminder scheduling failed (${response?.status ?? "network"}).` };
  return { scheduled: true };
}
