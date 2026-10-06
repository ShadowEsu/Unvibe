import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { welcomeHtml, welcomeText, WELCOME_SUBJECT } from "../emails/welcome";
import { feedbackRewardUrl, signEmail, verifyEmailSignature } from "./rewardLink";

const input = {
  email: "friend@example.com",
  referralCode: "AB12CD34",
  feedbackUrl: "https://unvibe.site/?feedback=1&e=friend%40example.com&t=abc",
  siteUrl: "https://unvibe.site",
};

describe("welcome email", () => {
  it("has the banner, Pro, referral and feedback month", () => {
    const html = welcomeHtml(input);
    assert.match(html, /email\/welcome-banner\.png/);
    assert.match(html, /unvibe\.site\/pricing/);
    assert.match(html, /\?ref=ab12cd34/);
    assert.match(html, /another free month of Pro/);
    assert.match(WELCOME_SUBJECT, /early access/);
    const text = welcomeText(input);
    assert.match(text, /Congrats/);
    assert.match(text, /feedback=1/);
    assert.doesNotMatch(text + html + WELCOME_SUBJECT, /[—–]/);
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
