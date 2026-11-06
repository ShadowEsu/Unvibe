import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Download } from "@/site/Download";
import { Home } from "@/site/Home";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { INSTALL_COPY } from "@/components/paper/InstallBox";
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

  it("each computer gets its own served command, file and first-open steps", () => {
    assert.equal(INSTALL_COPY.mac.command, BETA_INSTALL_COMMAND);
    assert.equal(INSTALL_COPY.windows.command, BETA_WINDOWS_INSTALL_COMMAND);
    assert.equal(INSTALL_COPY.windows.fileHref, BETA_WINDOWS_DIRECT_DOWNLOAD);
    assert.match(INSTALL_COPY.mac.steps.join(" "), /Click Done\..*Open Anyway/);
    assert.match(INSTALL_COPY.windows.steps.join(" "), /More info\..*Run anyway/);
  });

  it("never claims Apple approval or a bypass (Security S-2: 'not notarized by Apple yet' and stop there)", () => {
    for (const copy of Object.values(INSTALL_COPY)) {
      const text = [copy.title, copy.line, copy.fileLink, copy.stepsTitle, ...copy.steps, copy.note].join(" ");
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

const pages = [["home", () => renderToStaticMarkup(createElement(Home, { paymentsOpen: false }))], ["/beta", () => renderToStaticMarkup(createElement(Download))]] as const;

describe("Get Unvibe: the same install boxes on home #install and /beta", () => {
  for (const [name, render] of pages) {
    it(`${name} renders one box per computer under the Get Unvibe heading, the Mac one Terminal line first`, () => {
      const html = render();
      const get = html.slice(html.indexOf('id="install-title"'));
      assert.equal(count(get, /<div class="ninst" data-os="mac">/), 1, name);
      assert.equal(count(get, /<div class="ninst" data-os="windows">/), 1, name);
      const mac = get.slice(get.indexOf('data-os="mac"'), get.indexOf('data-os="windows"'));
      assert.ok(mac.indexOf(`<code>${escaped(BETA_INSTALL_COMMAND)}</code>`) > 0, `${name}: the Mac box shows the served command`);
      assert.ok(mac.indexOf(`href="${BETA_MAC_DIRECT_DOWNLOAD}"`) > mac.indexOf(`<code>${escaped(BETA_INSTALL_COMMAND)}</code>`), `${name}: the .dmg comes after the command`);
    });

    it(`${name}: no button downloads the .dmg (it isn't notarized yet; the Terminal line leads)`, () => {
      assert.doesNotMatch(render(), new RegExp(`<a [^>]*href="${BETA_MAC_DIRECT_DOWNLOAD}"[^>]*class="[^"]*lx-btn`));
      assert.doesNotMatch(render(), new RegExp(`<a [^>]*class="[^"]*lx-btn[^"]*"[^>]*href="${BETA_MAC_DIRECT_DOWNLOAD}"`));
    });
  }

  // Council R06 / Security 0152: on Windows the primary is the .exe itself; on a Mac it opens /beta, where the
  // Terminal line leads. /beta has no link back to itself.
  for (const [name, render, toBeta] of [["home", pages[0][1], true], ["/beta", pages[1][1], false]] as const) {
    it(`${name}: Download for Windows is the .exe${toBeta ? ", Download for Mac opens /beta" : " and nothing links back to /beta"}`, () => {
      const html = render();
      const get = html.slice(html.indexOf('id="install-title"'));
      assert.match(get, new RegExp(`<a [^>]*href="${BETA_WINDOWS_DIRECT_DOWNLOAD}"[^>]*>Download for Windows</a>`));
      assert.equal(/<a [^>]*href="\/beta"[^>]*>Download for Mac<\/a>/.test(get), toBeta);
    });
  }

  it("home: Get Unvibe is the last section", () => {
    const html = renderToStaticMarkup(createElement(Home, { paymentsOpen: false }));
    assert.equal(html.lastIndexOf("<section"), html.lastIndexOf("<section", html.indexOf('id="install"')), "#install is the last section");
  });
});
