import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { welcomeHtml, welcomeText, WELCOME_SUBJECT } from "../emails/welcome";
import { feedbackRewardUrl, signEmail, verifyEmailSignature } from "./rewardLink";
import { GIFT_LINK_NOTE, GIFT_OFFER } from "./giftOffer";

const input = {
  email: "friend@example.com",
  referralCode: "AB12CD34",
  feedbackUrl: "https://unvibe.site/?feedback=1&e=friend%40example.com&t=abc",
  unsubscribeUrl: "https://unvibe.site/api/unsubscribe?e=friend%40example.com&t=def",
  siteUrl: "https://unvibe.site",
};

describe("welcome email", () => {
  it("has the banner, referral and feedback month, and no Pro card or early-access claims", () => {
    const html = welcomeHtml(input);
    assert.match(html, /email\/welcome-banner\.png/);
    assert.match(html, /\?ref=ab12cd34/);
    assert.match(html, /a free month of Pro/);
    const text = welcomeText(input);
    assert.match(text, /Congrats/);
    assert.match(text, /feedback=1/);
    const all = text + html + WELCOME_SUBJECT;
    assert.doesNotMatch(all, /[—–]/);
    // Security W1 and W3 (2026-11-04): no account months for people without an account, no pricing link, no "early" claims.
    assert.doesNotMatch(all, /\/pricing|Want Pro|already starts with|early access|first people|in early/i);
  });

  it("states the shared gift rule in both parts, and no waitlist reward", () => {
    for (const part of [welcomeHtml(input), welcomeText(input)]) {
      assert.ok(part.includes(GIFT_OFFER));
      assert.ok(part.includes(GIFT_LINK_NOTE));
    }
    assert.doesNotMatch(welcomeHtml(input) + welcomeText(input), /joins with your link/);
  });

  it("has a visible unsubscribe link in both parts", () => {
    assert.match(welcomeHtml(input), /<a href="https:\/\/unvibe\.site\/api\/unsubscribe\?e=friend%40example\.com&amp;t=def"[^>]*>Unsubscribe<\/a>/);
    assert.match(welcomeText(input), /Unsubscribe any time: https:\/\/unvibe\.site\/api\/unsubscribe\?e=friend%40example\.com&t=def/);
  });

  it("promises only what follows: nothing from the waitlist, one tip from a download", () => {
    assert.match(welcomeHtml(input), /Just this email\. <a [^>]+>Unsubscribe<\/a> any time\./);
    assert.match(welcomeText(input), /Just this email\. Unsubscribe any time:/);
    const download = { ...input, setupTipFollows: true };
    assert.match(welcomeHtml(download), /This email and one setup tip tomorrow\. <a [^>]+>Unsubscribe<\/a> any time\./);
    assert.match(welcomeText(download), /This email and one setup tip tomorrow\. Unsubscribe any time:/);
    assert.doesNotMatch(welcomeHtml(input) + welcomeHtml(download), /One welcome email/);
  });

  it("escapes the address it is sent to", () => {
    assert.match(welcomeHtml({ ...input, email: "<x>@example.com" }), /&lt;x&gt;@example\.com/);
  });

  it("uses the installer link when it came from a download", () => {
    assert.match(welcomeText({ ...input, downloadUrl: "https://example.com/u.dmg" }), /Download Unvibe: https:\/\/example\.com\/u\.dmg/);
  });
});

describe("reward links", () => {
  it("only the signed email verifies", () => {
    process.env.REWARD_LINK_SECRET = "test-secret";
    const token = signEmail("Friend@Example.com");
    assert.equal(verifyEmailSignature("friend@example.com", token), true);
    assert.equal(verifyEmailSignature("someone@else.com", token), false);
    assert.equal(verifyEmailSignature("friend@example.com", "nope"), false);
    assert.match(feedbackRewardUrl("friend@example.com"), new RegExp(`t=${token}`));
  });
});

// Moved here from the deleted beta email test: Design's detect pass and the no-italics rule (4 Nov).
describe("welcome email: no emoji, upright type", () => {
  const html = welcomeHtml(input);
  const text = welcomeText(input);
  it("has no emoji or pictographs in the subject, text or HTML", () => {
    const pictograph = new RegExp("\\p{Extended_Pictographic}", "u");
    for (const part of [WELCOME_SUBJECT, text, html]) assert.doesNotMatch(part, pictograph);
  });
  it("sets nothing in italics: no <em>, <i> or italic style in the HTML", () => {
    assert.doesNotMatch(html, /<(em|i)\b|font-style:\s*italic/i);
  });
});
