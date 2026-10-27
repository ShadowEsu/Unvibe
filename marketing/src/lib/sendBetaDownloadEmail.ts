import { BETA_DOWNLOAD_SUBJECT, betaDownloadHtml, betaDownloadText } from "@/emails/betaDownload";
import { escapeEmailHtml } from "@/emails/betaShared";
import { SHORTCUTS } from "@/lib/shortcuts";
import { unsubscribeHeaders, unsubscribeUrl } from "@/lib/unsubscribe";
import { isEmailUnsubscribed } from "@/lib/waitlistStore";

export async function sendBetaDownloadEmail(input: {
  firstName: string;
  email: string;
  macDownloadUrl: string;
  referralCode: string;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, error: "Beta email delivery is not configured." };
  if (await isEmailUnsubscribed(input.email)) return { sent: false, error: "This address unsubscribed." };
  const from = process.env.WAITLIST_FROM_EMAIL?.trim() || "Unvibe Beta <onboarding@resend.dev>";
  const content = { ...input, unsubscribeUrl: unsubscribeUrl(input.email) };
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
      reply_to: "support@unvibe.site",
      subject: BETA_DOWNLOAD_SUBJECT,
      html: betaDownloadHtml(content),
      text: betaDownloadText(content),
      headers: unsubscribeHeaders(input.email),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  const data = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) return { sent: false, error: data.message || `Email delivery failed (${response.status}).` };
  return { sent: true, messageId: data.id };
}

/**
 * A friendly nudge a day after download, for the many people who install and forget.
 * Resend holds it and sends it later; nothing runs on our side in between, so an unsubscribe
 * during that day cancels it through cancelScheduledEmailsTo.
 */
export async function scheduleSetupReminder(email: string, referralCode: string): Promise<{ scheduled: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { scheduled: false, error: "Email delivery is not configured." };
  if (await isEmailUnsubscribed(email)) return { scheduled: false, error: "This address unsubscribed." };
  const from = process.env.WAITLIST_FROM_EMAIL?.trim() || "Unvibe Beta <onboarding@resend.dev>";
  const unsubscribe = unsubscribeUrl(email);
  const text = [
    "Hi, it's Vibe from Unvibe.",
    "",
    "Your first explanation is waiting. Three steps:",
    "1. Open Unvibe (it lives in your Dock or taskbar).",
    "2. Select any code in Cursor, VS Code or Terminal.",
    `3. Press ${SHORTCUTS.mac.anywhere} on Mac or ${SHORTCUTS.windows.anywhere} on Windows.`,
    "",
    "That's it. I'll explain it right beside your editor.",
    "",
    "Reply to this email if anything gets in the way. A human reads every reply.",
    "",
    `Unsubscribe: ${unsubscribe}`,
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.55;color:#141414;max-width:520px">
<p><b>Hi, it's Vibe from Unvibe.</b></p>
<p>Your first explanation is waiting. Three steps:</p>
<ol><li>Open Unvibe (it lives in your Dock or taskbar).</li><li>Select any code in Cursor, VS Code or Terminal.</li><li>Press <b>${SHORTCUTS.mac.anywhere}</b> on Mac or <b>${SHORTCUTS.windows.anywhere}</b> on Windows.</li></ol>
<p>That's it. I'll explain it right beside your editor.</p>
<p style="color:#66635d">Reply to this email if anything gets in the way. A human reads every reply.</p>
<p style="font-size:12px"><a href="${escapeEmailHtml(unsubscribe)}" style="color:#66635d">Unsubscribe</a></p></div>`;
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
      reply_to: "support@unvibe.site",
      subject: "Your first Unvibe explanation is waiting",
      html,
      text,
      headers: unsubscribeHeaders(email),
      scheduled_at: "in 1 day",
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!response?.ok) return { scheduled: false, error: `Reminder scheduling failed (${response?.status ?? "network"}).` };
  return { scheduled: true };
}

/** Pages back far enough to cover every reminder still waiting ("in 1 day" plus slack). */
const SCHEDULED_LOOKBACK_MS = 26 * 60 * 60 * 1000;
const MAX_LIST_PAGES = 10;

/**
 * Cancels emails Resend is still holding for this address, so someone who unsubscribes from
 * the welcome email never gets the setup reminder. We never store the scheduled id, so this
 * scans the last day of sends (newest first) for this recipient. Returns how many it cancelled.
 */
export async function cancelScheduledEmailsTo(email: string): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return 0;
  const target = email.trim().toLowerCase();
  const headers = { Authorization: `Bearer ${apiKey}` };
  const oldest = Date.now() - SCHEDULED_LOOKBACK_MS;
  let cancelled = 0;
  let after: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: "100" });
    if (after) query.set("after", after);
    const response = await fetch(`https://api.resend.com/emails?${query.toString()}`, {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Resend email list failed (${response.status}).`);
    const body = await response.json() as {
      has_more?: boolean;
      data?: Array<{ id: string; to?: string[]; created_at?: string; last_event?: string }>;
    };
    const items = body.data ?? [];
    for (const item of items) {
      if (item.last_event !== "scheduled") continue;
      if (!item.to?.some((recipient) => recipient.trim().toLowerCase() === target)) continue;
      const cancel = await fetch(`https://api.resend.com/emails/${encodeURIComponent(item.id)}/cancel`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(5_000),
      });
      if (!cancel.ok) throw new Error(`Resend cancel failed (${cancel.status}).`);
      cancelled += 1;
    }
    const last = items[items.length - 1];
    // Resend returns "2026-04-03 22:13:42.674981+00"; make it ISO so Date.parse is exact.
    const lastAt = Date.parse((last?.created_at ?? "").replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
    if (!body.has_more || !last || lastAt < oldest) break;
    after = last.id;
  }
  return cancelled;
}
