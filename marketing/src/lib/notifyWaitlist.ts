import { FOUNDER_EMAIL } from "@/lib/contact";
import type { WaitlistNotificationRecord } from "@/lib/waitlistStore";

export interface FounderNotificationInput {
  email: string;
  firstName: string;
  lastName: string;
  tool?: string;
  experience?: string;
  message?: string;
  referralCode: string;
  duplicate: boolean;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[character] ?? character,
  );
}

/** Every signup alert is intentionally delivered to the monitored founder inbox. */
function notifyTo(): string {
  return FOUNDER_EMAIL;
}

function emailHtml(entry: FounderNotificationInput): string {
  const rows = [
    ["Name", `${entry.firstName} ${entry.lastName}`],
    ["Email", entry.email],
    ["Tool", entry.tool ?? "Not provided"],
    ["Experience", entry.experience ?? "Not provided"],
    ["Message", entry.message || "None"],
  ];
  return `<!doctype html><html><body style="margin:0;background:#f6f1ff;font-family:Arial,sans-serif;color:#21172f"><div style="max-width:620px;margin:0 auto;padding:40px 20px"><div style="background:#fff;padding:32px;border:1px solid #d8c9ec"><p style="margin:0 0 10px;color:#6f45d2;font-size:12px;font-weight:700;letter-spacing:2px">UNVIBE PRIVATE BETA</p><h1 style="margin:0 0 24px;font-size:28px">New waitlist signup</h1><table style="width:100%;border-collapse:collapse">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:12px 8px;border-top:1px solid #eee5f5;color:#71657b;font-size:13px">${label}</td><td style="padding:12px 8px;border-top:1px solid #eee5f5;font-size:14px">${escapeHtml(value)}</td></tr>`,
    )
    .join(
      "",
    )}</table><p style="margin:24px 0 0"><a href="https://unvibe.site/waitlist" style="display:inline-block;background:#6f45d2;color:#fff;text-decoration:none;padding:13px 18px;font-weight:700">Open waitlist</a></p></div></div></body></html>`;
}

async function sendWithResend(entry: FounderNotificationInput, to: string): Promise<WaitlistNotificationRecord | null> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  const fallbackFrom = "Unvibe Waitlist <onboarding@resend.dev>";
  const configuredFrom = process.env.WAITLIST_FROM_EMAIL?.trim() || fallbackFrom;

  const attempt = async (from: string, recipient = to) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `unvibe-waitlist-${entry.referralCode}`,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        reply_to: entry.email,
        subject: `New Unvibe waitlist signup: ${entry.firstName} ${entry.lastName}`,
        html: emailHtml(entry),
        text: `New Unvibe waitlist signup\n\nName: ${entry.firstName} ${entry.lastName}\nEmail: ${entry.email}\nTool: ${entry.tool ?? "Not provided"}\nExperience: ${entry.experience ?? "Not provided"}\nMessage: ${entry.message || "None"}\n\nView: https://unvibe.site/waitlist`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    return { response, data };
  };

  let { response, data } = await attempt(configuredFrom);
  // Keep founder alerts working while a custom sending domain is awaiting
  // Resend verification. The Resend onboarding sender is limited, but it is
  // accepted for the account owner's inbox and is safer than losing a lead.
  if (
    !response.ok
    && response.status === 403
    && configuredFrom !== fallbackFrom
    && /domain is not verified/i.test(data.message ?? "")
  ) {
    ({ response, data } = await attempt(fallbackFrom));
  }
  // Resend's onboarding sender can only deliver to the account owner's email
  // until a custom domain is verified. Keep that owner-alert route server-only
  // and opt-in through an environment variable; the official sender remains
  // the default as soon as the Unvibe domain is verified.
  const testRecipient = process.env.RESEND_FALLBACK_EMAIL?.trim();
  if (
    !response.ok
    && response.status === 403
    && testRecipient
    && testRecipient !== to
    && /only send testing emails to your own email address/i.test(data.message ?? "")
  ) {
    ({ response, data } = await attempt(fallbackFrom, testRecipient));
  }
  if (!response.ok) throw new Error(`Resend notification failed: ${response.status} ${data.message ?? ""}`.trim());
  return { status: "sent", provider: "resend", at: new Date().toISOString(), messageId: data.id };
}

export async function notifyFounder(entry: FounderNotificationInput): Promise<WaitlistNotificationRecord> {
  if (entry.duplicate) return { status: "failed", provider: "none", at: new Date().toISOString() };
  const to = notifyTo();
  try {
    const resend = await sendWithResend(entry, to);
    if (resend) return resend;
    return { status: "failed", provider: "none", at: new Date().toISOString() };
  } catch (error) {
    console.error("resend waitlist notification failed", error);
    return { status: "failed", provider: "resend", at: new Date().toISOString() };
  }
}
