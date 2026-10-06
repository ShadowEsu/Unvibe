import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed links in our emails. The feedback link carries the reader's email plus a signature,
 * so only the person we emailed can earn the bonus Pro month for that address.
 */

function secret(): string {
  return process.env.REWARD_LINK_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

export function signEmail(email: string, purpose = "feedback"): string {
  const key = secret();
  if (!key) return "";
  return createHmac("sha256", key).update(`${purpose}:${email.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

export function verifyEmailSignature(email: string, token: string, purpose = "feedback"): boolean {
  const expected = signEmail(email, purpose);
  if (!expected || !/^[a-f0-9]{32}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://unvibe.site").replace(/\/$/, "");
}

export function feedbackRewardUrl(email: string): string {
  const params = new URLSearchParams({ feedback: "1", e: email.trim().toLowerCase(), t: signEmail(email) });
  return `${siteOrigin()}/?${params.toString()}`;
}
