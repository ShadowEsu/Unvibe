import { BETA_FEEDBACK_URL } from "../lib/betaOffer";

export { BETA_FEEDBACK_URL };

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character,
  );
}

export function safeFirstName(firstName: string): string { return firstName.trim() || "there"; }
export function betaThanksText(): string { return "Thank you for joining the Unvibe community, and for your support 💜"; }
export function betaEarlyNoteText(): string { return "We paused public installs while we finish signed Mac distribution and repair Windows sign-in reliability."; }
export function betaInstallText(): string {
  return "Mac will reopen after Developer ID signing and notarization. Windows will reopen after a clean-machine sign-in test passes. We will email the verified release page when your platform is ready.";
}
export function betaFeedbackText(): string {
  return `Your public-beta access will start with 30 days, 50 AI explanations, and 50 selected-code reviews. Share feedback here:\n${BETA_FEEDBACK_URL}`;
}
export function betaSignOffText(): string { return "Thank you again for being here 💜\n\nAI writes the code. Unvibe helps you understand it.\n\nBest,\nPreston Susanto\nFounder, Unvibe\nhttps://unvibe.site"; }
