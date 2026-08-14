const FEEDBACK_FORM_URL = "https://5fmnqm5vw5o.typeform.com/to/gtkkixB7";
const INSTALL_HELP_URL = "https://unvibe.site/beta#macos-install";

export const BETA_DOWNLOAD_SUBJECT = "Your Unvibe private beta download";

function safeName(firstName: string): string {
  return firstName.trim() || "there";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character,
  );
}

export function betaDownloadText(input: {
  firstName: string;
  macDownloadUrl: string;
  referralCode: string;
}): string {
  return `Hi ${safeName(input.firstName)}!

Thank you for joining the Unvibe waitlist. We truly appreciate your early interest and support.

You are now registered for the Unvibe private beta — version 0.1.10. Your beta includes 20 selected-code explanations, plus saved learning, quizzes, history, and progress tools.

This is an early beta, so you may encounter bugs, crashes, unfinished screens, or confusing parts of the experience. If something breaks, tell us what happened and what you were trying to do—your feedback directly shapes the next version.

Download the macOS beta:
${input.macDownloadUrl}

Once installed, you can select code in Cursor or VS Code, press Command-U, review the explanation, test your understanding, and save what you learned.

Important macOS notice:
The current beta is awaiting Apple notarization. If macOS blocks it, choose Done (not Move to Trash), then open System Settings → Privacy & Security and choose Open Anyway. Illustrated help: ${INSTALL_HELP_URL}

Share your feedback:
${FEEDBACK_FORM_URL}

If Unvibe helps you, complete the feedback form and we will add 4 months of Unvibe Pro to your account at no cost.

Your referral code is ${input.referralCode}. Every 3 verified referrals earns your choice of either 4 additional months of Unvibe Pro or a $5 USD reward. You can earn up to 5 rewards total ($25 maximum cash value). Eligibility and verification requirements apply.

Thank you for being one of Unvibe's earliest users.

AI writes the code. Unvibe helps you understand it.

Best,
Preston Susanto
Founder, Unvibe
https://unvibe.site`;
}

export function betaDownloadHtml(input: {
  firstName: string;
  macDownloadUrl: string;
  referralCode: string;
}): string {
  const name = escapeHtml(safeName(input.firstName));
  const downloadUrl = escapeHtml(input.macDownloadUrl);
  const referralCode = escapeHtml(input.referralCode);
  return `<!doctype html><html lang="en"><body style="margin:0;background:#100b18;color:#f8f3fb;font-family:Arial,sans-serif"><main style="max-width:620px;margin:0 auto;padding:36px 18px"><section style="padding:34px;background:linear-gradient(145deg,#1d132c,#160f20 58%,#3a211c);border:1px solid #7359a8"><p style="margin:0 0 12px;color:#bca1ff;font-size:12px;font-weight:700;letter-spacing:1.6px">UNVIBE PRIVATE BETA · V0.1.10</p><h1 style="margin:0 0 24px;font-size:28px;line-height:1.1">Your private beta is ready.</h1><p>Hi ${name}!</p><p>Thank you for joining the Unvibe waitlist. Your private beta includes <strong>20 selected-code explanations</strong>, plus saved learning, quizzes, history, and progress tools.</p><p>This is an early build, so you may encounter bugs or unfinished parts. If something breaks, tell us what happened and what you were trying to do—your feedback directly shapes the next version.</p><p style="margin:28px 0"><a href="${downloadUrl}" style="display:inline-block;padding:14px 20px;background:#bca1ff;color:#211431;text-decoration:none;font-weight:700">Download Unvibe for macOS</a></p><p><strong>Start in three steps:</strong> move Unvibe to Applications, allow Accessibility when prompted, then select code in Cursor or VS Code and press ⌘U.</p><p><strong>macOS notice:</strong> the current beta is awaiting Apple notarization. If macOS blocks it, choose <strong>Done</strong> (not Move to Trash), then open <strong>System Settings → Privacy &amp; Security → Open Anyway</strong>. <a href="${INSTALL_HELP_URL}" style="color:#d1c0ff">See installation help →</a></p><hr style="margin:30px 0;border:0;border-top:1px solid #4b3a5d"><h2 style="font-size:20px">Turn your feedback into Pro access.</h2><p>If Unvibe helps you, complete the official feedback form and we will add <strong>4 months of Unvibe Pro</strong> to your account at no cost.</p><p style="margin:22px 0"><a href="${FEEDBACK_FORM_URL}" style="color:#d1c0ff;font-weight:700">Complete the beta feedback survey →</a></p><p>Your referral code is <strong style="color:#bca1ff">${referralCode}</strong>. Every 3 verified referrals earns your choice of either 4 additional months of Pro or a $5 USD reward, up to 5 rewards total ($25 maximum cash value). Eligibility and verification requirements apply.</p><p style="margin-top:30px"><em>AI writes the code. Unvibe helps you understand it.</em></p><p>Best,<br><strong>Preston Susanto</strong><br>Founder, Unvibe<br><a href="https://unvibe.site" style="color:#bca1ff">unvibe.site</a></p></section></main></body></html>`;
}

export { FEEDBACK_FORM_URL, INSTALL_HELP_URL };
