import {
  BETA_CURL,
  BETA_FEEDBACK_URL,
  BETA_WINDOWS_COMMAND,
  betaEarlyNoteText,
  betaFeedbackText,
  betaInstallText,
  betaSignOffText,
  betaThanksText,
  escapeEmailHtml,
  safeFirstName,
} from "./betaShared";

export const BETA_INVITE_SUBJECT = "You're on the Unvibe private beta";

export function betaInviteText(firstName: string): string {
  return `Hi ${safeFirstName(firstName)},

${betaThanksText()}

${betaEarlyNoteText()}

${betaInstallText()}

${betaFeedbackText()}

${betaSignOffText()}`;
}

export function betaInviteHtml(firstName: string): string {
  const name = escapeEmailHtml(safeFirstName(firstName));
  const curl = escapeEmailHtml(BETA_CURL);
  const windows = escapeEmailHtml(BETA_WINDOWS_COMMAND);
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f6f1ff;color:#23192f;font-family:Arial,sans-serif"><main style="max-width:600px;margin:0 auto;padding:36px 18px"><section style="padding:32px;background:#fffdf8;border:1px solid #d8cde3"><p style="margin:0 0 12px;color:#6f45d2;font-size:12px;font-weight:700;letter-spacing:1.6px">UNVIBE PRIVATE BETA</p><h1 style="margin:0 0 24px;font-size:26px">You're on the Unvibe private beta</h1><p>Hi ${name},</p><p>Thank you so much for waitlisting, and for your support 💜</p><p>You're on the Unvibe private beta. This build is early, so bugs, crashes, and unfinished screens are expected. If something breaks, please tell us what you were doing. That note really helps.</p><p><strong>Apple silicon Mac</strong></p><p style="font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#f3eef8;padding:12px 14px">${curl}</p><p><strong>Windows x64 PowerShell</strong></p><p style="font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#f3eef8;padding:12px 14px">${windows}</p><p>macOS may warn that Unvibe is unsigned. Windows SmartScreen may say the same. That is expected until we notarize.</p><p>The beta includes 30 AI explanations. After you try it, fill the feedback form. That unlocks 1 week of Pro and your referral code. Waitlist gifts still add on.</p><p>Every 3 verified referrals earns $5, up to 5 rewards ($25). You can take Unvibe credit instead of a wire. We check eligibility first.</p><p style="margin:28px 0"><a href="${BETA_FEEDBACK_URL}" style="display:inline-block;padding:13px 18px;background:#6f45d2;color:#fff;text-decoration:none;font-weight:700">Open the feedback form</a></p><p>Thank you again for being here 💜</p><p><em>AI writes the code. Unvibe helps you understand it.</em></p><p>Best,<br><strong>Preston Susanto</strong><br>Founder, Unvibe<br><a href="https://unvibe.site" style="color:#6f45d2">unvibe.site</a></p></section></main></body></html>`;
}
