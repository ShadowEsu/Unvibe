import type { WaitlistEntry } from "@/lib/waitlistStore";

/**
 * True when the entry was created by a newsletter form: /api/waitlist stamps the consent with the
 * entry's own creation time. A waitlister who ticks the newsletter box later keeps an older
 * createdAt, so they still count as a beta signup. (Someone who subscribed first and then used a
 * beta form can't be told apart from a newsletter-only signup, and is skipped too.)
 */
export function isNewsletterOnly(entry: Pick<WaitlistEntry, "createdAt" | "newsletterConsent">): boolean {
  const consent = entry.newsletterConsent;
  return consent !== undefined && Date.parse(consent.at) === Date.parse(entry.createdAt);
}

/** Waitlist entries a beta invite may go to: never a newsletter-only signup (the newsletter mails nobody yet). */
export function betaInviteCandidates<T extends Pick<WaitlistEntry, "createdAt" | "newsletterConsent">>(entries: readonly T[]): T[] {
  return entries.filter((entry) => !isNewsletterOnly(entry));
}
