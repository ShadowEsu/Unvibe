import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { betaInviteCandidates, isNewsletterOnly } from "./betaInviteSelection";
import { NEWSLETTER_CONSENT_VERSION } from "./newsletterConsent";

const consent = (at: string) => ({ source: "newsletter" as const, consentVersion: NEWSLETTER_CONSENT_VERSION, at });

describe("beta invite selection", () => {
  const waitlister = { email: "beta@unvibe-mail.test", createdAt: "2026-10-20T10:00:00.000Z" };
  const subscriber = { email: "news@unvibe-mail.test", createdAt: "2026-10-28T18:00:00.000Z", newsletterConsent: consent("2026-10-28T18:00:00.000Z") };
  // Supabase reads the same instant back as +00:00.
  const subscriberFromDb = { email: "news-db@unvibe-mail.test", createdAt: "2026-10-28T18:00:00+00:00", newsletterConsent: consent("2026-10-28T18:00:00.000Z") };
  const waitlisterWhoSubscribed = { email: "both@unvibe-mail.test", createdAt: "2026-10-20T10:00:00.000Z", newsletterConsent: consent("2026-10-28T18:00:00.000Z") };

  it("never selects a newsletter-only signup", () => {
    assert.equal(isNewsletterOnly(subscriber), true);
    assert.equal(isNewsletterOnly(subscriberFromDb), true);
    assert.deepEqual(betaInviteCandidates([waitlister, subscriber, subscriberFromDb]).map((entry) => entry.email), [waitlister.email]);
  });

  it("still invites a waitlister who ticked the newsletter box later", () => {
    assert.equal(isNewsletterOnly(waitlister), false);
    assert.equal(isNewsletterOnly(waitlisterWhoSubscribed), false);
    assert.deepEqual(betaInviteCandidates([waitlisterWhoSubscribed]).map((entry) => entry.email), [waitlisterWhoSubscribed.email]);
  });
});
