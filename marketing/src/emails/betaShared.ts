import { BETA_FEEDBACK_URL, BETA_INSTALL_COMMAND, BETA_INSTALL_VERSION, BETA_WINDOWS_INSTALL_COMMAND } from "../lib/betaOffer";

export { BETA_FEEDBACK_URL };
export const BETA_CURL = BETA_INSTALL_COMMAND;
export const BETA_WINDOWS_COMMAND = BETA_WINDOWS_INSTALL_COMMAND;

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character,
  );
}

export function safeFirstName(firstName: string): string {
  return firstName.trim() || "there";
}

export function betaThanksText(): string {
  return "Thank you so much for waitlisting, and for your support 💜";
}

export function betaEarlyNoteText(): string {
  return "You're on the Unvibe private beta. This build is early, so bugs, crashes, and unfinished screens are expected. If something breaks, please tell us what you were doing. That note really helps.";
}

export function betaInstallText(): string {
  return `Install (${BETA_INSTALL_VERSION}). Free AI explanations every month.

Apple silicon Mac:
${BETA_CURL}

Windows x64 PowerShell:
${BETA_WINDOWS_COMMAND}

macOS may warn that Unvibe is unsigned. Windows SmartScreen may say the same. That is expected until we notarize.`;
}

export function betaFeedbackText(): string {
  return `The free plan includes AI explanations every month. After you try it, fill the feedback form:
${BETA_FEEDBACK_URL}

The form unlocks 1 week of Pro and your referral code. Waitlist gifts still add on. When a friend joins with your link using a new email, you each get a month of Pro: Expert depth and answers that use nearby files. Up to five friends.`;
}

export function betaSignOffText(): string {
  return `Thank you again for being here 💜

AI writes the code. Unvibe helps you understand it.

Best,
Preston Susanto
Founder, Unvibe
https://unvibe.site`;
}
