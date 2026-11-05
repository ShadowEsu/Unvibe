import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { betaDownloadHtml, betaDownloadText } from "../emails/betaDownload";
import { BETA_INVITE_SUBJECT, betaInviteHtml, betaInviteText } from "../emails/betaInvite";
import { BETA_CURL, BETA_FEEDBACK_URL } from "../emails/betaShared";
import { GIFT_LINK_NOTE, GIFT_OFFER } from "./giftOffer";

const UNSUBSCRIBE = "https://unvibe.site/api/unsubscribe?e=ohm%40example.com&t=abc";

describe("beta waitlist invite email", () => {
  it("includes curl, feedback, and the live reward rule", () => {
    const text = betaInviteText("Ohm", UNSUBSCRIBE);
    assert.match(BETA_INVITE_SUBJECT, /private beta/);
    assert.match(text, /Thank you so much for waitlisting/);
    assert.match(text, /Thank you again for being here\./);
    assert.match(text, new RegExp(BETA_CURL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /install\.ps1/);
    assert.match(text, /Windows x64 PowerShell/);
    assert.match(text, new RegExp(BETA_FEEDBACK_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /unvibe\.site\/feedback/);
    assert.doesNotMatch(text, /typeform/);
    assert.ok(text.includes(GIFT_OFFER) && text.includes(GIFT_LINK_NOTE));
    assert.doesNotMatch(text + betaInviteHtml("Ohm", UNSUBSCRIBE), /joins with your link|Waitlist gifts/);
    assert.doesNotMatch(text, /[—–]/);
    assert.doesNotMatch(betaInviteHtml("Ohm", UNSUBSCRIBE), /[—–]/);
  });

  it("has a visible unsubscribe link in both parts", () => {
    assert.match(betaInviteText("Ohm", UNSUBSCRIBE), /Unsubscribe: https:\/\/unvibe\.site\/api\/unsubscribe\?e=ohm%40example\.com&t=abc/);
    assert.match(betaInviteHtml("Ohm", UNSUBSCRIBE), /<a href="https:\/\/unvibe\.site\/api\/unsubscribe\?e=ohm%40example\.com&amp;t=abc"[^>]*>Unsubscribe<\/a>/);
  });
});

describe("beta emails: no emoji, upright type (Design detect pass and the no-italics rule, 4 Nov)", () => {
  const download = { firstName: "Ohm", macDownloadUrl: "https://example.com/unvibe.zip", unsubscribeUrl: UNSUBSCRIBE };
  const texts = [betaInviteText("Ohm", UNSUBSCRIBE), betaDownloadText(download)];
  const htmls = [betaInviteHtml("Ohm", UNSUBSCRIBE), betaDownloadHtml(download)];

  it("has no emoji or pictographs in the text or HTML of either email", () => {
    const pictograph = new RegExp("\\p{Extended_Pictographic}", "u");
    for (const part of [...texts, ...htmls]) assert.doesNotMatch(part, pictograph);
  });

  it("sets nothing in italics: no <em>, <i> or italic style in the HTML, no *emphasis* in the text", () => {
    for (const html of htmls) assert.doesNotMatch(html, /<(em|i)\b|font-style:\s*italic/i);
    for (const text of texts) assert.doesNotMatch(text, /\*[^*\s][^*]*\*/);
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
    assert.ok(text.includes(GIFT_OFFER) && text.includes(GIFT_LINK_NOTE));
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
