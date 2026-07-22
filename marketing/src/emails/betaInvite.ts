/**
 * Beta invite email sent to waitlist members. Copy is intentionally exact — this mirrors
 * the approved subject and body verbatim. Update FEEDBACK_FORM_URL if the Typeform changes.
 */

export const BETA_INVITE_SUBJECT = "You're Invited to Join the Unvibe Private Beta";

const FEEDBACK_FORM_URL = "https://5fmnqm5vw5o.typeform.com/to/gtkkixB7";

export function betaInviteText(): string {
  return `Dear Beta Tester,

Thank you for joining the Unvibe waitlist! We truly appreciate your early interest and support.

You're now registered for access to the Unvibe private beta. During the beta, you'll be able to test the product, explore how Unvibe explains AI-generated code, and share feedback that will help shape the experience before launch.

After testing Unvibe and completing the official feedback form, you'll receive:

3 months of Unvibe Pro at no cost

The feedback form will also give you access to your personal referral code. For each eligible referral who joins and completes the required steps, you may choose one of the following rewards:

An additional 3 months of Unvibe Pro
or
A $5 referral reward

Referral rewards will be issued after each referral is verified. Additional eligibility requirements and program terms may apply.

Your feedback will directly influence the features, explanations, and learning tools we prioritize as we continue improving Unvibe.

Feedback: ${FEEDBACK_FORM_URL}

Thank you again for being one of our earliest users. We're excited to have you building and learning with us.

AI writes the code. Unvibe helps you understand it.

Best,
Preston Susanto
Founder, Unvibe
unvibe.site`;
}

export function betaInviteHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${BETA_INVITE_SUBJECT}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f7f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;color:#0f141c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e6ee;border-radius:16px;padding:32px;">
            <tr>
              <td style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#4f46e5;font-weight:600;padding-bottom:16px;">
                Unvibe Private Beta
              </td>
            </tr>
            <tr>
              <td style="font-size:22px;font-weight:600;line-height:1.3;padding-bottom:20px;">
                You&rsquo;re invited to join the Unvibe private beta
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.65;color:#1f2937;">
                <p style="margin:0 0 16px;">Dear Beta Tester,</p>
                <p style="margin:0 0 16px;">Thank you for joining the Unvibe waitlist! We truly appreciate your early interest and support.</p>
                <p style="margin:0 0 16px;">You&rsquo;re now registered for access to the Unvibe private beta. During the beta, you&rsquo;ll be able to test the product, explore how Unvibe explains AI-generated code, and share feedback that will help shape the experience before launch.</p>
                <p style="margin:0 0 8px;">After testing Unvibe and completing the official feedback form, you&rsquo;ll receive:</p>
                <p style="margin:0 0 16px;font-weight:600;">3 months of Unvibe Pro at no cost</p>
                <p style="margin:0 0 16px;">The feedback form will also give you access to your personal referral code. For each eligible referral who joins and completes the required steps, you may choose one of the following rewards:</p>
                <p style="margin:0 0 4px;">An additional 3 months of Unvibe Pro</p>
                <p style="margin:0 0 16px;">or</p>
                <p style="margin:0 0 16px;">A $5 referral reward</p>
                <p style="margin:0 0 16px;">Referral rewards will be issued after each referral is verified. Additional eligibility requirements and program terms may apply.</p>
                <p style="margin:0 0 24px;">Your feedback will directly influence the features, explanations, and learning tools we prioritize as we continue improving Unvibe.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${FEEDBACK_FORM_URL}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:999px;">
                  Open the feedback form
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.65;color:#1f2937;">
                <p style="margin:0 0 16px;">Thank you again for being one of our earliest users. We&rsquo;re excited to have you building and learning with us.</p>
                <p style="margin:0 0 24px;font-style:italic;color:#4b5666;">AI writes the code. Unvibe helps you understand it.</p>
                <p style="margin:0;">Best,<br />Preston Susanto<br />Founder, Unvibe<br /><a href="https://unvibe.site" style="color:#4f46e5;">unvibe.site</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
