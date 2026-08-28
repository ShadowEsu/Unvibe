import { BETA_CURL, BETA_FEEDBACK_URL, BETA_WINDOWS_COMMAND, betaEarlyNoteText, betaFeedbackText, betaInstallText, betaSignOffText, betaThanksText, escapeEmailHtml, safeFirstName } from "./betaShared";

export const BETA_DOWNLOAD_SUBJECT = "Your Unvibe beta install";
export { BETA_FEEDBACK_URL as FEEDBACK_FORM_URL };

export function betaDownloadText(input: {
  firstName: string;
  macDownloadUrl: string;
  referralCode: string;
}): string {
  return `Hi ${safeFirstName(input.firstName)},

${betaThanksText()}

${betaEarlyNoteText()}

${betaInstallText()}

Direct download if you need it:
${input.macDownloadUrl}

${betaFeedbackText()}

Your referral code is ${input.referralCode}.

${betaSignOffText()}`;
}

export function betaDownloadHtml(input: {
  firstName: string;
  macDownloadUrl: string;
  referralCode: string;
}): string {
  const name = escapeEmailHtml(safeFirstName(input.firstName));
  const downloadUrl = escapeEmailHtml(input.macDownloadUrl);
  const referralCode = escapeEmailHtml(input.referralCode);
  const curl = escapeEmailHtml(BETA_CURL);
  const windows = escapeEmailHtml(BETA_WINDOWS_COMMAND);
  return `<!doctype html><html lang="en"><body style="margin:0;background:#100b18;color:#f8f3fb;font-family:Arial,sans-serif"><main style="max-width:620px;margin:0 auto;padding:36px 18px"><section style="padding:34px;background:#160f20;border:1px solid #7359a8"><p style="margin:0 0 12px;color:#bca1ff;font-size:12px;font-weight:700;letter-spacing:1.6px">UNVIBE PRIVATE BETA</p><h1 style="margin:0 0 24px;font-size:28px;line-height:1.1">Your Unvibe beta install</h1><p>Hi ${name},</p><p>Thank you so much for waitlisting, and for your support 💜</p><p>You're on the Unvibe private beta. This build is early, so bugs, crashes, and unfinished screens are expected. If something breaks, please tell us what you were doing. That note really helps.</p><p><strong>Apple silicon Mac</strong></p><p style="font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#211431;padding:12px 14px">${curl}</p><p><strong>Windows x64 PowerShell</strong></p><p style="font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#211431;padding:12px 14px">${windows}</p><p>macOS may warn that Unvibe is unsigned. Windows SmartScreen may say the same. That is expected until we notarize.</p><p style="margin:28px 0"><a href="${downloadUrl}" style="display:inline-block;padding:14px 20px;background:#bca1ff;color:#211431;text-decoration:none;font-weight:700">Direct download</a></p><p>The beta includes 30 AI explanations. After you try it, fill the feedback form. That unlocks 1 week of Pro and your referral code. Waitlist gifts still add on.</p><p style="margin:22px 0"><a href="${BETA_FEEDBACK_URL}" style="color:#d1c0ff;font-weight:700">Open the feedback form</a></p><p>Your referral code is <strong style="color:#bca1ff">${referralCode}</strong>. Every 3 verified referrals earns $5, up to 5 rewards ($25). You can take Unvibe credit instead of a wire. We check eligibility first.</p><p>Thank you again for being here 💜</p><p style="margin-top:30px"><em>AI writes the code. Unvibe helps you understand it.</em></p><p>Best,<br><strong>Preston Susanto</strong><br>Founder, Unvibe<br><a href="https://unvibe.site" style="color:#bca1ff">unvibe.site</a></p></section></main></body></html>`;
}
