import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { betaDownloadHtml, betaDownloadText } from "../emails/betaDownload";
import { BETA_INVITE_SUBJECT, betaInviteHtml, betaInviteText } from "../emails/betaInvite";
import { BETA_CURL, BETA_FEEDBACK_URL } from "../emails/betaShared";

describe("beta waitlist invite email", () => {
  it("includes curl, feedback, and the live reward rule", () => {
    const text = betaInviteText("Ohm");
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
    assert.match(text, /Every 3 verified referrals/);
    assert.doesNotMatch(text, /[—–]/);
    assert.doesNotMatch(betaInviteHtml("Ohm"), /[—–]/);
  });
});

describe("beta download email", () => {
  const input = {
    firstName: "Test User",
    macDownloadUrl: "https://example.com/unvibe.zip",
    referralCode: "AB12CD34",
  };

  it("contains curl, the real download, feedback, and referral rule", () => {
    const text = betaDownloadText(input);
    assert.match(text, /https:\/\/example\.com\/unvibe\.zip/);
    assert.match(text, new RegExp(BETA_CURL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, new RegExp(BETA_FEEDBACK_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /unvibe\.site\/feedback/);
    assert.doesNotMatch(text, /typeform/);
    assert.match(text, /1 week of Pro/);
    assert.match(text, /Every 3 verified referrals/);
    assert.match(text, /AB12CD34/);
    assert.match(text, /\$25/);
    assert.doesNotMatch(text, /[—–]/);
  });

  it("escapes personalized HTML", () => {
    const html = betaDownloadHtml({ ...input, firstName: "<Test>" });
    assert.match(html, /&lt;Test&gt;/);
    assert.doesNotMatch(html, /Hi <Test>/);
  });
});
