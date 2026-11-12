import { createHmac } from "node:crypto";

/**
 * A waitlister's referral code (the `?ref=` in their invite link and the key of /api/referrals/<code>).
 *
 * Security audit 11 Nov, F1: the code used to be sha256(email)[:8], which anyone could compute from an email. Joining
 * once with `referredBy` set to that code and then reading /api/referrals/<code> told them whether that email was on
 * the list (the count is ≥ 1 only for a member's code). An HMAC keyed by a server secret cannot be computed from the
 * email alone, so a code is only ever known to the person it was sent to. Codes made before this change stay as
 * stored (an entry's code never changes); Security treats those as known exposure.
 *
 * The key is RATE_LIMIT_KEY_SECRET, the private secret the signup routes already require, under its own domain
 * string so referral codes and rate-limit buckets never share a digest. Locally (no VERCEL_ENV, not production) a
 * fixed development key keeps codes deterministic for tests.
 */
export function referralCodeFor(email: string): string {
  const localDevelopment = process.env.NODE_ENV !== "production" && !process.env.VERCEL_ENV;
  const secret = process.env.RATE_LIMIT_KEY_SECRET?.trim() || (localDevelopment ? "unvibe-local-rate-limit" : "");
  if (!secret) throw new Error("referral code secret missing: set RATE_LIMIT_KEY_SECRET");
  return createHmac("sha256", secret).update(`referral-code:${email.trim().toLowerCase()}`).digest("hex").slice(0, 8);
}
