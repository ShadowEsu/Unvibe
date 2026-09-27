import { BETA_FEEDBACK_URL, betaEarlyNoteText, betaFeedbackText, betaInstallText, betaSignOffText, betaThanksText, escapeEmailHtml, safeFirstName } from "./betaShared";

export const BETA_INVITE_SUBJECT = "Unvibe release update";

export function betaInviteText(firstName: string): string {
  return `Hi ${safeFirstName(firstName)},\n\n${betaThanksText()}\n\n${betaEarlyNoteText()}\n\n${betaInstallText()}\n\n${betaFeedbackText()}\n\n${betaSignOffText()}`;
}

export function betaInviteHtml(firstName: string): string {
  const name = escapeEmailHtml(safeFirstName(firstName));
  return `<!doctype html><html><body style="margin:0;background:#f6f1ff;color:#23192f;font-family:Arial,sans-serif"><main style="max-width:600px;margin:0 auto;padding:36px 18px"><section style="padding:32px;background:#fffdf8;border:1px solid #d8cde3"><p style="margin:0 0 12px;color:#6f45d2;font-size:12px;font-weight:700;letter-spacing:1.6px">UNVIBE RELEASE UPDATE</p><h1 style="margin:0 0 24px;font-size:26px">Thanks for joining Unvibe</h1><p>Hi ${name},</p><p>Thank you so much for waitlisting, and for your support 💜</p><p>We paused public installs while we finish signed Mac distribution and repair Windows sign-in reliability. We will send you the verified release page when your platform is ready.</p><p>Your public-beta access will start with 30 days, 50 AI explanations, and 50 selected-code reviews.</p><p style="margin:28px 0"><a href="${BETA_FEEDBACK_URL}" style="display:inline-block;padding:13px 18px;background:#6f45d2;color:#fff;text-decoration:none;font-weight:700">Share feedback</a></p><p>Thank you again for being here 💜</p><p><em>AI writes the code. Unvibe helps you understand it.</em></p><p>Best,<br><strong>Preston Susanto</strong><br>Founder, Unvibe<br><a href="https://unvibe.site" style="color:#6f45d2">unvibe.site</a></p></section></main></body></html>`;
}
