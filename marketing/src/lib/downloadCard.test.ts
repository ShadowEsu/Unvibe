import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import BetaDownloadsPage from "@/app/beta/page";
import { BetaInstall, FirstOpen } from "@/components/paper/BetaInstall";
import { DOWNLOADS, downloadChoice } from "./downloadCard";
import { MAC_META, WINDOWS_META } from "./downloadMeta";
import { detectVisitorDevice } from "./shortcuts";

// tsx compiles JSX to React.createElement, so rendering components here needs React in scope.
Object.assign(globalThis, { React });

const UA = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

const card = () => renderToStaticMarkup(createElement(BetaInstall, { tone: "page", surface: "beta", title: null, showFeedback: false }));
const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, "g"))?.length ?? 0;

describe("download card: one button for the visitor's computer", () => {
  it("a Windows visitor gets the Windows file as the one primary, Macs in the other row", () => {
    const choice = downloadChoice(detectVisitorDevice(UA.windows), false);
    assert.equal(choice.primary, "windows");
    assert.equal(DOWNLOADS.windows.primaryLabel, "Download for Windows");
    assert.deepEqual(choice.others, ["mac", "mac-intel"]);
  });

  it("a Mac visitor gets Apple silicon; a detected Intel Mac gets the Intel file", () => {
    assert.deepEqual(downloadChoice(detectVisitorDevice(UA.mac), false), { primary: "mac", others: ["mac-intel", "windows"] });
    assert.deepEqual(downloadChoice(detectVisitorDevice(UA.mac), true), { primary: "mac-intel", others: ["mac", "windows"] });
  });

  it("a phone gets no file to download", () => {
    assert.deepEqual(downloadChoice(detectVisitorDevice(UA.iphone), false), { primary: null, others: [] });
  });

  it("renders one primary button, the file in words and the other downloads, with no Mac/Windows tabs", () => {
    const html = card();
    assert.equal(count(html, /class="paper-beta__download-btn"/), 1);
    assert.match(html, />Download for Mac</);
    assert.ok(html.includes(MAC_META), "meta line names chip, version and size");
    assert.doesNotMatch(html, /aria-pressed|aria-label="Install platform"|role="tab"/);
    const others = /<div class="dl-card__others" role="group" aria-label="Other downloads">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
    for (const label of ["Intel Mac", "Windows 10 or 11", "Install from the terminal"]) assert.match(others, new RegExp(`>${label}<`));
    assert.match(html, /Apple hasn&#x27;t verified Unvibe yet, so the first open takes a few extra steps in System Settings\./);
  });

  it("Windows meta line and the SmartScreen steps say what the visitor will meet", () => {
    assert.match(WINDOWS_META, /^Windows 10 or 11, x64\. Portable app, version \d+\.\d+\.\d+, about \d+ MB\.$/);
    const steps = renderToStaticMarkup(createElement(FirstOpen, { build: "windows" }));
    assert.match(steps, /<li>If your browser warns, choose <b>Keep<\/b>\.<\/li>/);
    assert.match(steps, /<li>If Windows says it protected your PC, choose <b>More info<\/b>, then <b>Run anyway<\/b>\.<\/li>/);
    const mac = renderToStaticMarkup(createElement(FirstOpen, { build: "mac" }));
    assert.match(mac, /press <b>Done<\/b>/);
    assert.match(mac, /<b>Open Anyway<\/b>/);
  });

  it("no list item is only an arrow (W13: screen readers announced two \"right arrow\" items)", () => {
    const items = Array.from(card().matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g), (m) => m[1].replace(/<[^>]+>/g, "").trim());
    assert.equal(items.length, 3);
    for (const text of items) assert.doesNotMatch(text, /^[→←›»>\-–—\s]*$/);
  });
});

describe("download card: the same card on home #install and /beta", () => {
  for (const [name, Page] of [["home", HomePage], ["/beta", BetaDownloadsPage]] as const) {
    it(`${name} renders it inside #install`, () => {
      const html = renderToStaticMarkup(createElement(Page));
      const install = html.slice(html.indexOf('id="install"'));
      assert.ok(html.includes('id="install"'), `${name} has no #install`);
      assert.match(install, /^[^]*?class="paper-beta paper-beta--page dl-card"/);
      assert.equal(count(html, /class="paper-beta paper-beta--page dl-card"/), 1);
    });
  }
});

describe("home has one download card", () => {
  it("the closing card links to #install instead of repeating the downloads", () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    assert.equal(count(html, /class="paper-beta paper-beta--page dl-card"/), 1);
    const closing = html.slice(html.indexOf('class="paper-invite__card'));
    assert.match(closing, /^[^]*?<a class="paper-join paper-join--mac" href="#install"><span class="paper-join__label">Go to the download<\/span><\/a>/);
    assert.doesNotMatch(closing.slice(0, closing.indexOf("</section>")), /releases\/download|Download free for/);
  });
});
