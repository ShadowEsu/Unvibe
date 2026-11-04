import { FREE_MONTHLY_ALLOWANCE, TRIAL_ALLOWANCE } from "../lib/allowance";
import { BETA_FEEDBACK_URL, BETA_INSTALL_COMMAND, BETA_INSTALL_VERSION, BETA_WINDOWS_INSTALL_COMMAND } from "../lib/betaOffer";
import { GIFT_LINK_NOTE, GIFT_OFFER } from "../lib/giftOffer";

export { BETA_FEEDBACK_URL };
export const BETA_CURL = BETA_INSTALL_COMMAND;
export const BETA_WINDOWS_COMMAND = BETA_WINDOWS_INSTALL_COMMAND;

/** The allowances, from lib/allowance like every page that states one. */
export const FREE_USE_NOTE = `Without an account you get ${TRIAL_ALLOWANCE}. Sign in for ${FREE_MONTHLY_ALLOWANCE} on Free.`;

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
  return `Install (${BETA_INSTALL_VERSION}).

Apple silicon Mac:
${BETA_CURL}

Windows x64 PowerShell:
${BETA_WINDOWS_COMMAND}

macOS may warn that Unvibe is unsigned. Windows SmartScreen may say the same. That is expected until we notarize.`;
}

export function betaFeedbackText(): string {
  return `${FREE_USE_NOTE} After you try it, tell us how it went in the feedback form:
${BETA_FEEDBACK_URL}

${GIFT_LINK_NOTE} ${GIFT_OFFER}`;
}

export function betaSignOffText(): string {
  return `Thank you again for being here 💜

AI writes the code. Unvibe helps you understand it.

Best,
The Unvibe team
https://unvibe.site`;
}
