import { BETA_FEEDBACK_URL, betaEarlyNoteText, betaFeedbackText, betaInstallText, betaSignOffText, betaThanksText, escapeEmailHtml, safeFirstName } from "./betaShared";

export const BETA_DOWNLOAD_SUBJECT = "Unvibe verified release update";
export { BETA_FEEDBACK_URL as FEEDBACK_FORM_URL };

export function betaDownloadText(input: { firstName: string; macDownloadUrl: string; referralCode: string }): string {
  void input.macDownloadUrl;
  return `Hi ${safeFirstName(input.firstName)},\n\n${betaThanksText()}\n\n${betaEarlyNoteText()}\n\n${betaInstallText()}\n\n${betaFeedbackText()}\n\nYour referral code is ${input.referralCode}.\n\n${betaSignOffText()}`;
}

export function betaDownloadHtml(input: { firstName: string; macDownloadUrl: string; referralCode: string }): string {
  void input.macDownloadUrl;
  const name = escapeEmailHtml(safeFirstName(input.firstName));
  const referralCode = escapeEmailHtml(input.referralCode);
  return `<!doctype html><html lang="en"><body style="margin:0;background:#100b18;color:#f8f3fb;font-family:Arial,sans-serif"><main style="max-width:620px;margin:0 auto;padding:36px 18px"><section style="padding:34px;background:#160f20;border:1px solid #7359a8"><p style="margin:0 0 12px;color:#bca1ff;font-size:12px;font-weight:700;letter-spacing:1.6px">UNVIBE RELEASE UPDATE</p><h1 style="margin:0 0 24px;font-size:28px;line-height:1.1">Your verified Unvibe release is being prepared</h1><p>Hi ${name},</p><p>Thank you so much for waitlisting, and for your support 💜</p><p>We paused public installers while we finish signed Mac distribution and repair Windows sign-in reliability. We will send the verified release page when your platform is ready.</p><p>Your public-beta access will start with 30 days, 50 AI explanations, and 50 selected-code reviews.</p><p style="margin:22px 0"><a href="${BETA_FEEDBACK_URL}" style="color:#d1c0ff;font-weight:700">Share feedback</a></p><p>Your referral code is <strong style="color:#bca1ff">${referralCode}</strong>. Every 3 verified referrals earns $5, up to 5 rewards ($25). You can take Unvibe credit instead of a wire. We check eligibility first.</p><p>Thank you again for being here 💜</p><p style="margin-top:30px"><em>AI writes the code. Unvibe helps you understand it.</em></p><p>Best,<br><strong>Preston Susanto</strong><br>Founder, Unvibe<br><a href="https://unvibe.site" style="color:#bca1ff">unvibe.site</a></p></section></main></body></html>`;
}
