import { createHash } from "node:crypto";
import { signEmail, siteOrigin, verifyEmailSignature } from "./rewardLink";

/**
 * Unsubscribe links in every email we send to a waitlist or download signup.
 * The link carries the address plus an HMAC (REWARD_LINK_SECRET, same as the feedback link,
 * under its own purpose) so nobody can unsubscribe someone else.
 */

const PURPOSE = "unsubscribe";

/** Encapsulates the purpose, so a feedback-link token can never unsubscribe anyone. */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  return verifyEmailSignature(email, token, PURPOSE);
}

export function unsubscribeUrl(email: string): string {
  const normalized = email.trim().toLowerCase();
  const params = new URLSearchParams({ e: normalized, t: signEmail(normalized, PURPOSE) });
  return `${siteOrigin()}/api/unsubscribe?${params.toString()}`;
}

/** RFC 8058 one-click headers, passed as the Resend `headers` field. */
export function unsubscribeHeaders(email: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(email)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Suppression records are keyed by this hash, so the store never holds a plaintext address. */
export function suppressionKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** The send decision: an address that unsubscribed never gets another email from us. */
export function withoutUnsubscribed<T extends { email: string }>(entries: readonly T[], unsubscribedKeys: ReadonlySet<string>): T[] {
  return entries.filter((entry) => !unsubscribedKeys.has(suppressionKey(entry.email)));
}
