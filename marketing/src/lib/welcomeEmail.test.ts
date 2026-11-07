import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { welcomeHtml, welcomeText, WELCOME_PREVIEW, WELCOME_SUBJECT } from "../emails/welcome";
import { BETA_INSTALL_COMMAND, BETA_WINDOWS_INSTALL_COMMAND } from "./betaOffer";
import { feedbackRewardUrl, signEmail, verifyEmailSignature } from "./rewardLink";

const input = {
  email: "friend@example.com",
  unsubscribeUrl: "https://unvibe.site/api/unsubscribe?e=friend%40example.com&t=def",
  siteUrl: "https://unvibe.site",
};

describe("welcome email (onboarding email 1, Security S-2 0002)", () => {
  it("has one button, and it goes to /beta: given by the download route, or the site's /beta from the waitlist", () => {
    const fromDownload = { ...input, downloadUrl: "https://unvibe.site/beta" };
    for (const sent of [input, fromDownload]) {
      const buttons = Array.from(welcomeHtml(sent).matchAll(/<a href="([^"]+)"[^>]*>Get Unvibe<\/a>/g));
      assert.deepEqual(buttons.map((match) => match[1]), ["https://unvibe.site/beta"]);
      assert.match(welcomeText(sent), /^Get Unvibe: https:\/\/unvibe\.site\/beta$/m);
    }
  });

  it("shows both install commands from betaOffer as code, never hard-coded", () => {
    const html = welcomeHtml(input);
    assert.ok(html.includes(`<code>${BETA_INSTALL_COMMAND}</code></pre>`), "the Mac command is a code block");
    assert.ok(html.includes(`<code>${BETA_WINDOWS_INSTALL_COMMAND}</code></pre>`), "the Windows command is a code block");
    const lines = welcomeText(input).split("\n");
    assert.ok(lines.includes(BETA_INSTALL_COMMAND), "the Mac command is on its own line");
    assert.ok(lines.includes(BETA_WINDOWS_INSTALL_COMMAND), "the Windows command is on its own line");
    assert.doesNotMatch(readFileSync(path.resolve("src/emails/welcome.ts"), "utf8"), /install\.(sh|ps1)|curl |irm /);
  });

  it("links the install help in both parts", () => {
    assert.ok(welcomeHtml(input).includes('href="https://unvibe.site/install-help"'));
    assert.match(welcomeText(input), /Here is exactly what to press: https:\/\/unvibe\.site\/install-help/);
  });

  it("has no invite-link or Pro-month card (A2), and no Security W1/W3 claims", () => {
    const all = welcomeHtml(input) + welcomeText(input) + WELCOME_SUBJECT + WELCOME_PREVIEW;
    assert.doesNotMatch(all, /invite|\?ref=|referral|\bPro\b|free month|feedback=1|Give feedback|welcome-banner|btn-[a-z]+\.png/i);
    assert.doesNotMatch(all, /\/pricing|Want Pro|already starts with|early access|first people|in early/i);
  });

  it("puts the preview text first in the HTML", () => {
    assert.match(welcomeHtml(input), new RegExp(`<div style="display:none[^"]*">${WELCOME_PREVIEW}</div>`));
  });

  it("has a visible unsubscribe link in both parts", () => {
    assert.match(welcomeHtml(input), /Unsubscribe any time: <a href="https:\/\/unvibe\.site\/api\/unsubscribe\?e=friend%40example\.com&amp;t=def"[^>]*>https:\/\/unvibe\.site\/api\/unsubscribe\?e=friend%40example\.com&amp;t=def<\/a>/);
    assert.match(welcomeText(input), /Unsubscribe any time: https:\/\/unvibe\.site\/api\/unsubscribe\?e=friend%40example\.com&t=def$/);
  });

  it("promises only what follows: nothing from the waitlist, one tip when the box was ticked", () => {
    assert.match(welcomeHtml(input), /unvibe\.site<\/a>\. Just this email\. Unsubscribe any time:/);
    assert.match(welcomeText(input), /at unvibe\.site\. Just this email\. Unsubscribe any time:/);
    const tip = { ...input, setupTipFollows: true };
    assert.match(welcomeHtml(tip), /unvibe\.site<\/a>\. This email and one setup tip tomorrow\. Unsubscribe any time:/);
    assert.match(welcomeText(tip), /at unvibe\.site\. This email and one setup tip tomorrow\. Unsubscribe any time:/);
    assert.doesNotMatch(welcomeHtml(input) + welcomeText(input), /setup tip/);
    assert.doesNotMatch(welcomeHtml(tip) + welcomeText(tip), /Just this email/);
  });

  it("escapes every interpolated value in the HTML", () => {
    const html = welcomeHtml({ ...input, email: "<x>@example.com", unsubscribeUrl: 'https://unvibe.site/u?"x"<y>', downloadUrl: 'https://unvibe.site/beta?"<b>' });
    assert.match(html, /&lt;x&gt;@example\.com/);
    assert.ok(html.includes("https://unvibe.site/u?&quot;x&quot;&lt;y&gt;"));
    assert.ok(html.includes("https://unvibe.site/beta?&quot;&lt;b&gt;"));
    assert.doesNotMatch(html, /<x>|<y>|<b>&|"x"/);
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
describe("welcome email: no dashes, no emoji, upright type", () => {
  const parts = [WELCOME_SUBJECT, WELCOME_PREVIEW, welcomeText(input), welcomeHtml(input), welcomeHtml({ ...input, setupTipFollows: true })];
  it("has no em or en dashes in the subject, preview, text or HTML", () => {
    for (const part of parts) assert.doesNotMatch(part, /[—–]/);
  });
  it("has no emoji or pictographs in the subject, preview, text or HTML", () => {
    const pictograph = new RegExp("\\p{Extended_Pictographic}", "u");
    for (const part of parts) assert.doesNotMatch(part, pictograph);
  });
  it("sets nothing in italics: no <em>, <i> or italic style in the HTML", () => {
    assert.doesNotMatch(welcomeHtml(input), /<(em|i)\b|font-style:\s*italic/i);
  });
});
