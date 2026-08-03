const FEEDBACK_FORM_URL = "https://5fmnqm5vw5o.typeform.com/to/gtkkixB7";

export const BETA_INVITE_SUBJECT = "You’re Invited to Join the Unvibe Private Beta";

function safeName(firstName: string): string {
  return firstName.trim() || "there";
}

export function betaInviteText(firstName: string): string {
  return `Hi ${safeName(firstName)},

Thank you for joining the Unvibe waitlist. We truly appreciate your early interest and support.

You’re now registered for access to the Unvibe private beta. During the beta, you’ll be able to test the product, explore how Unvibe explains AI-generated code, and share feedback that will help shape the experience before launch.

After testing Unvibe and completing the official feedback form, you’ll receive:

3 months of Unvibe Pro at no cost

The feedback form will also give you access to your personal referral code. For each eligible referral who joins and completes the required steps, you may choose one of the following rewards:

An additional 3 months of Unvibe Pro
or
A $5 referral reward

Referral rewards will be issued after each referral is verified. Additional eligibility requirements and program terms may apply.

Your feedback will directly influence the features, explanations, and learning tools we prioritize as we continue improving Unvibe.

Complete the feedback form: ${FEEDBACK_FORM_URL}

Thank you again for being one of our earliest users. We’re excited to have you building and learning with us.

AI writes the code. Unvibe helps you understand it.

Best,
Preston Susanto
Founder, Unvibe
https://unvibe.site`;
}

export function betaInviteHtml(firstName: string): string {
  const name = safeName(firstName).replace(/[&<>"']/g, (value) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[value] ?? value);
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f6f1ff;color:#23192f;font-family:Arial,sans-serif"><main style="max-width:600px;margin:0 auto;padding:36px 18px"><section style="padding:32px;background:#fffdf8;border:1px solid #d8cde3"><p style="margin:0 0 12px;color:#6f45d2;font-size:12px;font-weight:700;letter-spacing:1.6px">UNVIBE PRIVATE BETA</p><h1 style="margin:0 0 24px;font-size:26px">You’re invited to join the Unvibe private beta</h1><p>Hi ${name},</p><p>Thank you for joining the Unvibe waitlist. We truly appreciate your early interest and support.</p><p>You’re now registered for access to the Unvibe private beta. During the beta, you’ll be able to test the product, explore how Unvibe explains AI-generated code, and share feedback that will help shape the experience before launch.</p><p>After testing Unvibe and completing the official feedback form, you’ll receive:</p><p style="font-weight:700">3 months of Unvibe Pro at no cost</p><p>The feedback form will also give you access to your personal referral code. For each eligible referral who joins and completes the required steps, you may choose one of the following rewards:</p><p><strong>An additional 3 months of Unvibe Pro</strong><br>or<br><strong>A $5 referral reward</strong></p><p>Referral rewards will be issued after each referral is verified. Additional eligibility requirements and program terms may apply.</p><p>Your feedback will directly influence the features, explanations, and learning tools we prioritize as we continue improving Unvibe.</p><p style="margin:28px 0"><a href="${FEEDBACK_FORM_URL}" style="display:inline-block;padding:13px 18px;background:#6f45d2;color:#fff;text-decoration:none;font-weight:700">Complete the feedback form</a></p><p>Thank you again for being one of our earliest users. We’re excited to have you building and learning with us.</p><p><em>AI writes the code. Unvibe helps you understand it.</em></p><p>Best,<br><strong>Preston Susanto</strong><br>Founder, Unvibe<br><a href="https://unvibe.site" style="color:#6f45d2">unvibe.site</a></p></section></main></body></html>`;
}
