import { escapeEmailHtml as escape } from "@/emails/escapeHtml";
import { BETA_INSTALL_COMMAND } from "@/lib/betaOffer";
import { siteOrigin } from "@/lib/rewardLink";
import { SHORTCUTS } from "@/lib/shortcuts";
import { unsubscribeHeaders, unsubscribeUrl } from "@/lib/unsubscribe";
import { isEmailUnsubscribed } from "@/lib/waitlistStore";

export interface SetupTipInput {
  /** Signed unsubscribe link for the footer, see lib/unsubscribe. */
  unsubscribeUrl: string;
  siteUrl: string;
}

export const SETUP_TIP_SUBJECT = "Your setup tip: try Unvibe on code you didn't write";
export const SETUP_TIP_PREVIEW = `Copy a few lines from any file and paste them into Unvibe. Then let ${SHORTCUTS.mac.anywhere} do it straight from your editor.`;

// Copy: unvibe-support's onboarding email 2 (Security S-2 0002), casual rewrite for ledger 569 with the same facts and links. Where it lives, per the app: the
// Mac Dock icon always shows and the tray icon sits in the menu bar or notification area
// (app/src/main/main.ts). The footer promises nothing else is scheduled: this is the only email
// sent with scheduled_at, so a later lifecycle email must change that line in the same change.
export function setupTipText(input: SetupTipInput): string {
  const site = input.siteUrl.replace(/\/$/, "");
  return `Hi again,

Here's the setup tip you asked for: try Unvibe on real code of your own today.

1. Open Unvibe. You'll find it in your Dock or taskbar, with an icon in the Mac menu bar or the Windows notification area.
2. Open a file you didn't write yourself, maybe from an AI tool or a teammate, and copy a few lines.
3. Paste them into Unvibe. The explanation opens in a panel beside your editor, where you can ask a follow-up or press Test me.

Then skip the copying altogether:

- On a Mac, select code in any app and press ${SHORTCUTS.mac.anywhere}. The first time, macOS asks you to allow Accessibility so Unvibe can copy your selection: ${site}/help/accessibility
- On Windows, select code and press ${SHORTCUTS.windows.anywhere}. Nothing to allow.

Fix a shortcut that does nothing: ${site}/help/shortcut

Haven't installed it yet? Paste this into Terminal on a Mac: ${BETA_INSTALL_COMMAND}, or get the Windows version at ${site}/beta.

If anything gets in the way, reply to this email and we'll help.

Have fun with it,
The Unvibe team

You asked for one setup tip when you got Unvibe at unvibe.site. This is it, and nothing else is scheduled. Unsubscribe any time: ${input.unsubscribeUrl}`;
}

export function setupTipHtml(input: SetupTipInput): string {
  const site = input.siteUrl.replace(/\/$/, "");
  const link = "color:#141414;font-weight:700;word-break:break-all";
  const code = "font-family:Menlo,Consolas,monospace;font-size:14px;padding:2px 6px;border:1px solid #141414;border-radius:6px;background:#ffffff;word-break:break-all";
  const accessibility = escape(`${site}/help/accessibility`);
  const beta = escape(`${site}/beta`);
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.55;color:#141414;max-width:520px">
<div style="display:none;max-height:0;overflow:hidden">${escape(SETUP_TIP_PREVIEW)}</div>
<p>Hi again,</p>
<p>Here's the setup tip you asked for: try Unvibe on real code of your own today.</p>
<ol><li>Open Unvibe. You'll find it in your Dock or taskbar, with an icon in the Mac menu bar or the Windows notification area.</li><li>Open a file you didn't write yourself, maybe from an AI tool or a teammate, and copy a few lines.</li><li>Paste them into Unvibe. The explanation opens in a panel beside your editor, where you can ask a follow-up or press Test me.</li></ol>
<p>Then skip the copying altogether:</p>
<ul><li><b>On a Mac,</b> select code in any app and press <b>${escape(SHORTCUTS.mac.anywhere)}</b>. The first time, macOS asks you to allow Accessibility so Unvibe can copy your selection: <a href="${accessibility}" style="${link}">${accessibility}</a></li><li><b>On Windows,</b> select code and press <b>${escape(SHORTCUTS.windows.anywhere)}</b>. Nothing to allow.</li></ul>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 20px"><tr><td bgcolor="#d9f45c" style="border:2px solid #141414;border-radius:14px;background:#d9f45c"><a href="${escape(`${site}/help/shortcut`)}" style="display:inline-block;padding:12px 22px;font-size:16px;font-weight:800;line-height:1.2;color:#141414;text-decoration:none">Fix a shortcut that does nothing</a></td></tr></table>
<p>Haven't installed it yet? Paste this into Terminal on a Mac: <code style="${code}">${escape(BETA_INSTALL_COMMAND)}</code>, or get the Windows version at <a href="${beta}" style="${link}">${beta}</a>.</p>
<p>If anything gets in the way, reply to this email and we'll help.</p>
<p>Have fun with it,<br><b>The Unvibe team</b></p>
<p style="font-size:12px;color:#66635d">You asked for one setup tip when you got Unvibe at <a href="${escape(site)}" style="color:#66635d">unvibe.site</a>. This is it, and nothing else is scheduled. Unsubscribe any time: <a href="${escape(input.unsubscribeUrl)}" style="color:#66635d;word-break:break-all">${escape(input.unsubscribeUrl)}</a></p></div>`;
}

/**
 * The one setup tip, a day after the welcome, for people who ticked "Also email me one setup tip tomorrow".
 * Resend holds it and sends it later; nothing runs on our side in between, so an unsubscribe
 * during that day cancels it through cancelScheduledEmailsTo.
 */
export async function scheduleSetupReminder(email: string, referralCode: string): Promise<{ scheduled: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { scheduled: false, error: "Email delivery is not configured." };
  if (await isEmailUnsubscribed(email)) return { scheduled: false, error: "This address unsubscribed." };
  // No fallback sender: without the configured address, nothing is scheduled (named, never its value).
  const from = process.env.WAITLIST_FROM_EMAIL?.trim();
  if (!from) {
    console.error("setup tip not scheduled: WAITLIST_FROM_EMAIL is not set");
    return { scheduled: false, error: "WAITLIST_FROM_EMAIL is not set." };
  }
  const content = { unsubscribeUrl: unsubscribeUrl(email), siteUrl: siteOrigin() };
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
      subject: SETUP_TIP_SUBJECT,
      html: setupTipHtml(content),
      text: setupTipText(content),
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
