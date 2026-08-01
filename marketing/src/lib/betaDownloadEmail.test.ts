import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { betaDownloadHtml, betaDownloadText } from "../emails/betaDownload";

describe("beta download email", () => {
  const input = {
    firstName: "Test User",
    macDownloadUrl: "https://example.com/unvibe.zip",
    referralCode: "AB12CD34",
  };

  it("contains the real download, feedback reward, and referral rule", () => {
    const text = betaDownloadText(input);
    assert.match(text, /https:\/\/example\.com\/unvibe\.zip/);
    assert.match(text, /3 months of Unvibe Pro/);
    assert.match(text, /Every 3 verified referrals/);
    assert.match(text, /\$25 maximum cash value/);
    assert.doesNotMatch(text, /Windows.*attached/i);
  });

  it("escapes personalized HTML", () => {
    const html = betaDownloadHtml({ ...input, firstName: "<Test>" });
    assert.match(html, /&lt;Test&gt;/);
    assert.doesNotMatch(html, /Hi <Test>/);
  });
});
