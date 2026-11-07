import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { SETUP_TIP_PREVIEW, SETUP_TIP_SUBJECT, setupTipHtml, setupTipText } from "./sendBetaDownloadEmail";
import { BETA_INSTALL_COMMAND } from "./betaOffer";
import { SHORTCUTS } from "./shortcuts";

const input = {
  unsubscribeUrl: "https://unvibe.site/api/unsubscribe?e=friend%40example.com&t=def",
  siteUrl: "https://unvibe.site",
};

describe("setup tip email (onboarding email 2, Security S-2 0002)", () => {
  it("links the live help pages (O-1): Accessibility, the shortcut button and /beta", () => {
    const html = setupTipHtml(input);
    assert.ok(html.includes('href="https://unvibe.site/help/accessibility"'));
    assert.match(html, /<a href="https:\/\/unvibe\.site\/help\/shortcut"[^>]*>Fix a shortcut that does nothing<\/a>/);
    assert.ok(html.includes('href="https://unvibe.site/beta"'));
    const text = setupTipText(input);
    assert.match(text, /copy your selection: https:\/\/unvibe\.site\/help\/accessibility$/m);
    assert.match(text, /^Fix a shortcut that does nothing: https:\/\/unvibe\.site\/help\/shortcut$/m);
    assert.match(text, /get the Windows version at https:\/\/unvibe\.site\/beta\./);
  });

  it("names the shortcuts from lib/shortcuts and the Mac command from betaOffer, as code", () => {
    const html = setupTipHtml(input);
    const text = setupTipText(input);
    for (const keys of [SHORTCUTS.mac.anywhere, SHORTCUTS.windows.anywhere]) {
      assert.ok(html.includes(`<b>${keys}</b>`));
      assert.ok(text.includes(`press ${keys}.`));
    }
    assert.match(html, new RegExp(`<code[^>]*>${BETA_INSTALL_COMMAND.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</code>`));
    assert.ok(text.includes(`Terminal on a Mac: ${BETA_INSTALL_COMMAND}, or`));
    assert.doesNotMatch(readFileSync(path.resolve("src/lib/sendBetaDownloadEmail.ts"), "utf8"), /install\.(sh|ps1)|curl |irm /);
  });

  it("promises nothing else is scheduled (O-3), and keeps a visible unsubscribe link in both parts", () => {
    const footer = "This is it, and nothing else is scheduled. Unsubscribe any time:";
    assert.match(setupTipHtml(input), /This is it, and nothing else is scheduled\. Unsubscribe any time: <a href="https:\/\/unvibe\.site\/api\/unsubscribe\?e=friend%40example\.com&amp;t=def"/);
    assert.ok(setupTipText(input).endsWith(`${footer} ${input.unsubscribeUrl}`));
  });

  it("is the only email that schedules a send (O-3)", () => {
    const sources = readdirSync(path.resolve("src"), { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .map((file) => path.join("src", file));
    const scheduled = sources.filter((file) => /scheduled_at:|scheduledAt:/.test(readFileSync(path.resolve(file), "utf8")));
    assert.deepEqual(scheduled, [path.join("src", "lib", "sendBetaDownloadEmail.ts")]);
    assert.equal(readFileSync(path.resolve("src/lib/sendBetaDownloadEmail.ts"), "utf8").match(/scheduled_at:/g)?.length, 1);
  });

  it("drops the overclaim \"A human reads every reply\" (A4)", () => {
    assert.doesNotMatch(setupTipHtml(input) + setupTipText(input), /human reads/i);
  });

  it("puts the preview text first in the HTML", () => {
    assert.ok(setupTipHtml(input).includes(`<div style="display:none;max-height:0;overflow:hidden">${SETUP_TIP_PREVIEW}</div>`));
  });

  it("escapes every interpolated value in the HTML", () => {
    const html = setupTipHtml({ unsubscribeUrl: 'https://unvibe.site/u?"x"<y>', siteUrl: 'https://unvibe.site/"<s>' });
    assert.ok(html.includes("https://unvibe.site/u?&quot;x&quot;&lt;y&gt;"));
    assert.ok(html.includes("https://unvibe.site/&quot;&lt;s&gt;/help/shortcut"));
    assert.doesNotMatch(html, /<y>|<s>|"x"/);
  });

  it("has no em or en dashes, no emoji and no italics", () => {
    const parts = [SETUP_TIP_SUBJECT, SETUP_TIP_PREVIEW, setupTipText(input), setupTipHtml(input)];
    const pictograph = new RegExp("\\p{Extended_Pictographic}", "u");
    for (const part of parts) {
      assert.doesNotMatch(part, /[—–]/);
      assert.doesNotMatch(part, pictograph);
    }
    assert.doesNotMatch(setupTipHtml(input), /<(em|i)\b|font-style:\s*italic/i);
  });
});
