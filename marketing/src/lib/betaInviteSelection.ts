import type { WaitlistEntry } from "@/lib/waitlistStore";

type Selectable = Pick<WaitlistEntry, "createdAt" | "newsletterConsent" | "signupSource">;

/**
 * True when a newsletter form created the entry. `signupSource` is written once, on insert, so a
 * later newsletter post can't change it (Security R-1). Entries without it (older rows, waitlist and
 * beta signups) are not newsletter-only, even if they ticked the newsletter box later.
 */
export function isNewsletterOnly(entry: Selectable): boolean {
  return entry.signupSource === "newsletter";
}

/** Waitlist entries a beta invite may go to: never a newsletter-only signup (the newsletter mails nobody yet). */
export function betaInviteCandidates<T extends Selectable>(entries: readonly T[]): T[] {
  return entries.filter((entry) => !isNewsletterOnly(entry));
}
