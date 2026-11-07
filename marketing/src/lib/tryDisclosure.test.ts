import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/privacy/page";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

const marketingRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * NEXT_PUBLIC_AI_MAINTENANCE is read once when aiMaintenance.ts loads (Next inlines it at build time),
 * so each flag state renders in its own process: the Try box and the kit, as the build would.
 */
function renderWithFlag(flag: "1" | ""): { tryIt: string; kit: string } {
  const script = [
    'const React = require("react");',
    'const { renderToStaticMarkup } = require("react-dom/server");',
    "Object.assign(globalThis, { React });",
    'const { TryIt } = require("@/components/paper/TryIt");',
    'const { kitMarkdown } = require("@/lib/kit");',
    "process.stdout.write(JSON.stringify({",
    "  tryIt: renderToStaticMarkup(React.createElement(TryIt)),",
    "  kit: kitMarkdown(),",
    "}));",
  ].join("\n");
  const run = spawnSync(path.join(marketingRoot, "node_modules/.bin/tsx"), ["-e", script], {
    cwd: marketingRoot,
    env: { ...process.env, NEXT_PUBLIC_AI_MAINTENANCE: flag },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

const paused = renderWithFlag("1");
const live = renderWithFlag("");
const PAUSED_LINE = "AI features are paused for maintenance. Back soon.";

// Try it sends the pasted code to Unvibe's server and Anthropic. Nothing about it runs in the browser.
describe("Try it disclosure", () => {
  it("the kit says the pasted code goes to Unvibe and Anthropic, not that it runs in the browser", () => {
    assert.match(live.kit, /try it online at https:\/\/unvibe\.site\/explain \(the pasted code goes to Unvibe and Anthropic's Claude API\)/);
    assert.doesNotMatch(live.kit, /in the browser/i);
  });

  it("while Try it is paused, the kit points only at the download", () => {
    assert.match(paused.kit, /Call to action: https:\/\/unvibe\.site \(download\)\.\n/);
    assert.doesNotMatch(paused.kit, /try it online/i);
  });

  it("while Try it is paused, the box shows only the maintenance note", () => {
    const body = paused.tryIt.slice(paused.tryIt.indexOf('class="try__body"'));
    assert.ok(body.includes(`<p role="status">${PAUSED_LINE}</p>`), body.slice(0, 400));
    assert.doesNotMatch(body, /paper-join/);
    assert.doesNotMatch(body, /Explain it<\/b> for the sample/);
  });

  it("with Try it on, the box is as before: the prompt and no download", () => {
    const body = live.tryIt.slice(live.tryIt.indexOf('class="try__body"'));
    assert.match(body, /Press <b>Explain it<\/b> for the sample, or paste your own code first\./);
    assert.ok(!body.includes(PAUSED_LINE));
    assert.doesNotMatch(body, /paper-join/);
  });

  it("the privacy page says the server refuses key formats and names the promo record", () => {
    const page = renderToStaticMarkup(createElement(PrivacyPage)).replace(/\s+/g, " ");
    assert.doesNotMatch(page, /generates explanations from the filtered snippet/);
    assert.match(page, /sent to Unvibe&#x27;s server, which refuses common key formats, and then to Anthropic to write/);
    assert.match(page, /Anthropic&#x27;s Claude API/);
    assert.match(page, /href="https:\/\/www.anthropic.com\/legal\/commercial-terms"/);
    assert.match(page, /Unvibe is for people 18 or older, as our <a href="\/terms">Terms<\/a> say\./);
    assert.match(page, /nothing is checked in your browser/);
    assert.match(page, /redemption record: a fingerprint of the code \(not the code itself\), your account and its email/);
    assert.match(page, /the link to your account and the email are removed/);
  });
});

// The Try box lives on /explain; the home page links nowhere it isn't.
describe("Try it links", () => {
  it("/app and the kit point at /explain, and the home page has no #try-it link", () => {
    assert.match(readFileSync(path.join(marketingRoot, "next.config.mjs"), "utf8"), /source: "\/app", destination: "\/explain"/);
    assert.doesNotMatch(readFileSync(path.join(marketingRoot, "src/site/dia/Home.tsx"), "utf8"), /#try-it/);
  });
});
