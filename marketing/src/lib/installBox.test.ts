import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderHome } from "./testRenderHome";
import BetaDownloadsPage from "@/app/beta/page";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { INSTALL_COPY } from "@/components/paper/InstallBox";
import { D_THANKS } from "@/site/dia/content";
import {
  BETA_INSTALL_COMMAND,
  BETA_MAC_DIRECT_DOWNLOAD,
  BETA_WINDOWS_DIRECT_DOWNLOAD,
  BETA_WINDOWS_INSTALL_COMMAND,
} from "./betaOffer";
import { betaInstallScript } from "./betaInstallScript";

// tsx compiles JSX to React.createElement, so rendering components here needs React in scope.
Object.assign(globalThis, { React });

const card = () => renderToStaticMarkup(createElement(BetaInstall, { tone: "page", surface: "beta", title: null, showFeedback: false }));
const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, "g"))?.length ?? 0;
const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;").replace(/>/g, "&gt;").replace(/</g, "&lt;");

describe("install box: the Terminal line first, the file second", () => {
  it("the download card leads with the exact served Mac command, then the .dmg with its steps open", () => {
    const html = card();
    const command = html.indexOf(`<code>${escaped(BETA_INSTALL_COMMAND)}</code>`);
    const file = html.indexOf(`href="${BETA_MAC_DIRECT_DOWNLOAD}"`);
    assert.ok(command > 0, "the copy box shows the served command");
    assert.ok(file > command, "the .dmg link comes after the command");
    assert.match(html, /<details class="ninst__steps" open="">/);
    assert.equal(count(html, /class="paper-beta__download-btn"/), 0, "no big download button leads to the blocked path");
    assert.match(html, />Copy</);
  });

  it("each computer gets its own served command and file", () => {
    assert.equal(INSTALL_COPY.mac.command, BETA_INSTALL_COMMAND);
    assert.equal(INSTALL_COPY.windows.command, BETA_WINDOWS_INSTALL_COMMAND);
    assert.equal(INSTALL_COPY.windows.fileHref, BETA_WINDOWS_DIRECT_DOWNLOAD);
  });

  it("never claims Apple approval or a bypass (Security S-2: 'not notarized by Apple yet' and stop there)", () => {
    const thanks = [D_THANKS.fastest, D_THANKS.fastLine, D_THANKS.orFile, D_THANKS.ledeWindows].join(" ");
    const texts = Object.values(INSTALL_COPY).map((copy) => [copy.title, copy.line, copy.fileLink, copy.stepsTitle, ...copy.steps, copy.note].join(" "));
    for (const text of [...texts, thanks]) {
      assert.doesNotMatch(text, /\bverified\b|\bsafe\b|apple-approved|bypass|(?<!self-)\bsigned by\b/i);
    }
  });

  it("no list item is only an arrow (W13: screen readers announced two \"right arrow\" items)", () => {
    const items = Array.from(card().matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g), (m) => m[1].replace(/<[^>]+>/g, "").trim());
    assert.equal(items.length, 6, "3 quick-start steps and 3 first-open steps");
    for (const text of items) assert.doesNotMatch(text, /^[→←›»>\-–—\s]*$/);
  });
});

describe("install.sh: a download cut off part way runs nothing", () => {
  it("bash given any truncated copy of the script prints nothing and exits with an error", () => {
    const script = betaInstallScript();
    for (const fraction of [0.25, 0.5, 0.9, 0.995]) {
      const cut = script.slice(0, Math.floor(script.length * fraction));
      // An empty PATH: even if a cut-off copy did run a line, it could reach no curl, hdiutil or open.
      const run = spawnSync("/bin/bash", ["-s"], { input: cut, encoding: "utf8", env: { ...process.env, PATH: "/nonexistent" } });
      assert.notEqual(run.status, 0, `cut at ${fraction}`);
      assert.equal(run.stdout, "", `cut at ${fraction} ran something: ${run.stdout}`);
    }
  });
});

describe("/beta: one install box inside #install, Terminal line first (MUST-D13)", () => {
  it("renders the box once, the command before the .dmg links, the first-open steps open", () => {
    const html = renderToStaticMarkup(createElement(BetaDownloadsPage));
    const install = html.slice(html.indexOf('id="install"'));
    assert.ok(html.includes('id="install"'), "/beta has no #install");
    assert.equal(count(html, /class="ninst"/), 1);
    const command = install.indexOf('class="ninst__box"');
    const dmg = install.indexOf(BETA_MAC_DIRECT_DOWNLOAD);
    assert.ok(command >= 0 && dmg > command, "the Terminal line comes before the .dmg");
    assert.match(install.slice(dmg), /<details class="ninst__steps" open="">/);
  });
});

describe("home: every download button is the one-click download, /beta without JS", () => {
  it("each one carries its server fallback to /beta and the file pick", async () => {
    const html = await renderHome();
    const buttons = html.match(/<a [^>]*data-dl=""[^>]*>/g) ?? [];
    assert.ok(buttons.length >= 1);
    for (const button of buttons) assert.match(button, /href="\/beta"/);
    // No install box on home: the download is one click, the steps follow on /beta's thank-you.
    assert.doesNotMatch(html, /class="ninst"/);
  });
});
