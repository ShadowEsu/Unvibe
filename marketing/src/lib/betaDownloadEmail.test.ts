import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { betaDownloadHtml, betaDownloadText } from "../emails/betaDownload";
import { BETA_INVITE_SUBJECT, betaInviteHtml, betaInviteText } from "../emails/betaInvite";
import { BETA_CURL, BETA_FEEDBACK_URL } from "../emails/betaShared";

const UNSUBSCRIBE = "https://unvibe.site/api/unsubscribe?e=ohm%40example.com&t=abc";

describe("beta waitlist invite email", () => {
  it("includes curl, feedback, and the live reward rule", () => {
    const text = betaInviteText("Ohm", UNSUBSCRIBE);
    assert.match(BETA_INVITE_SUBJECT, /private beta/);
    assert.match(text, /Thank you so much for waitlisting/);
    assert.match(text, /💜/);
    assert.match(text, new RegExp(BETA_CURL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /install\.ps1/);
    assert.match(text, /Windows x64 PowerShell/);
    assert.match(text, new RegExp(BETA_FEEDBACK_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /unvibe\.site\/feedback/);
    assert.doesNotMatch(text, /typeform/);
    assert.match(text, /1 week of Pro/);
    assert.match(text, /When a friend signs in to the Unvibe app and enters your code, you each get a month of Pro: Expert depth and answers that use nearby files\. Up to five friends\./);
    assert.doesNotMatch(text + betaInviteHtml("Ohm", UNSUBSCRIBE), /joins with your link|Waitlist gifts/);
    assert.doesNotMatch(text, /[—–]/);
    assert.doesNotMatch(betaInviteHtml("Ohm", UNSUBSCRIBE), /[—–]/);
  });

  it("has a visible unsubscribe link in both parts", () => {
    assert.match(betaInviteText("Ohm", UNSUBSCRIBE), /Unsubscribe: https:\/\/unvibe\.site\/api\/unsubscribe\?e=ohm%40example\.com&t=abc/);
    assert.match(betaInviteHtml("Ohm", UNSUBSCRIBE), /<a href="https:\/\/unvibe\.site\/api\/unsubscribe\?e=ohm%40example\.com&amp;t=abc"[^>]*>Unsubscribe<\/a>/);
  });
});

describe("beta download email", () => {
  const input = {
    firstName: "Test User",
    macDownloadUrl: "https://example.com/unvibe.zip",
    unsubscribeUrl: UNSUBSCRIBE,
  };

  it("contains curl, the real download, feedback, and the gift rule", () => {
    const text = betaDownloadText(input);
    assert.match(text, /https:\/\/example\.com\/unvibe\.zip/);
    assert.match(text, new RegExp(BETA_CURL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, new RegExp(BETA_FEEDBACK_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /unvibe\.site\/feedback/);
    assert.doesNotMatch(text, /typeform/);
    assert.match(text, /1 week of Pro/);
    assert.match(text, /When a friend signs in to the Unvibe app and enters your code, you each get a month of Pro: Expert depth and answers that use nearby files\. Up to five friends\./);
    assert.doesNotMatch(text + betaDownloadHtml(input), /joins with your link|Waitlist gifts|referral code/);
    assert.doesNotMatch(text, /\$25/);
    assert.doesNotMatch(text, /[—–]/);
    assert.match(text, /Unsubscribe: https:\/\/unvibe\.site\/api\/unsubscribe/);
    assert.match(betaDownloadHtml(input), />Unsubscribe<\/a>/);
  });

  it("escapes personalized HTML", () => {
    const html = betaDownloadHtml({ ...input, firstName: "<Test>" });
    assert.match(html, /&lt;Test&gt;/);
    assert.doesNotMatch(html, /Hi <Test>/);
  });
});
