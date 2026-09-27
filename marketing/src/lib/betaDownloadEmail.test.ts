import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { betaDownloadHtml, betaDownloadText } from "../emails/betaDownload";
import { BETA_INVITE_SUBJECT, betaInviteHtml, betaInviteText } from "../emails/betaInvite";
import { BETA_FEEDBACK_URL } from "../emails/betaShared";

describe("beta waitlist invite email", () => {
  it("routes beta recipients to the verified-release update and feedback", () => {
    const text = betaInviteText("Ohm");
    assert.match(BETA_INVITE_SUBJECT, /release update/);
    assert.match(text, /Thank you so much for waitlisting/);
    assert.match(text, /💜/);
    assert.match(text, /Developer ID signing/);
    assert.match(text, /clean-machine sign-in test/);
    assert.match(text, new RegExp(BETA_FEEDBACK_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /unvibe\.site\/feedback/);
    assert.doesNotMatch(text, /typeform/);
    assert.match(text, /50 AI explanations/);
    assert.match(text, /verified release page/);
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

  it("does not mail an unverified download command or URL", () => {
    const text = betaDownloadText(input);
    assert.doesNotMatch(text, /https:\/\/example\.com\/unvibe\.zip/);
    assert.doesNotMatch(text, /install\.sh|install\.ps1|curl|PowerShell/);
    assert.match(text, new RegExp(BETA_FEEDBACK_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /unvibe\.site\/feedback/);
    assert.doesNotMatch(text, /typeform/);
    assert.match(text, /50 AI explanations/);
    assert.match(text, /verified release page/);
    assert.match(text, /AB12CD34/);
    assert.doesNotMatch(text, /[—–]/);
  });

  it("escapes personalized HTML", () => {
    const html = betaDownloadHtml({ ...input, firstName: "<Test>" });
    assert.match(html, /&lt;Test&gt;/);
    assert.doesNotMatch(html, /Hi <Test>/);
  });
});
