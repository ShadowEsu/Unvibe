import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { betaInviteCandidates, isNewsletterOnly } from "./betaInviteSelection";
import { NEWSLETTER_CONSENT_VERSION } from "./newsletterConsent";

const consent = (at: string) => ({ source: "newsletter" as const, consentVersion: NEWSLETTER_CONSENT_VERSION, at });

describe("beta invite selection (Security R-1)", () => {
  const waitlister = { email: "beta@unvibe-mail.test", createdAt: "2026-10-20T10:00:00.000Z" };
  const subscriber = { email: "news@unvibe-mail.test", createdAt: "2026-10-28T18:00:00.000Z", signupSource: "newsletter" as const, newsletterConsent: consent("2026-10-28T18:00:00.000Z") };
  // The consent time no longer matches the creation time (a later newsletter post, or a different
  // timestamp format): the entry is still newsletter-only, because the form that created it says so.
  const subscriberPostedAgain = { ...subscriber, email: "news-again@unvibe-mail.test", newsletterConsent: consent("2026-10-28T19:30:00.000Z") };
  const waitlisterWhoSubscribed = { email: "both@unvibe-mail.test", createdAt: "2026-10-20T10:00:00.000Z", newsletterConsent: consent("2026-10-20T10:00:00.000Z") };

  it("never selects an entry a newsletter form created, whatever its consent time", () => {
    assert.equal(isNewsletterOnly(subscriber), true);
    assert.equal(isNewsletterOnly(subscriberPostedAgain), true);
    assert.deepEqual(betaInviteCandidates([waitlister, subscriber, subscriberPostedAgain]).map((entry) => entry.email), [waitlister.email]);
  });

  it("still invites a waitlister who ticked the newsletter box, even at the same instant they joined", () => {
    assert.equal(isNewsletterOnly(waitlister), false);
    assert.equal(isNewsletterOnly(waitlisterWhoSubscribed), false);
    assert.deepEqual(betaInviteCandidates([waitlisterWhoSubscribed]).map((entry) => entry.email), [waitlisterWhoSubscribed.email]);
  });
});
