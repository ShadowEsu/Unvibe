import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KEPT, SENT } from "@/components/paper/WhatLeaves";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

// Production builds with the AI outage switch on (BOSS 31 Oct); TryIt reads it when its module loads,
// so the page is imported after the switch is set: a static import would load TryIt first.
// node --test runs each file in its own process.
let html = "";
let text = "";
before(async () => {
  process.env.NEXT_PUBLIC_AI_MAINTENANCE = "1";
  const { default: HomePage } = await import("@/app/page");
  html = renderToStaticMarkup(createElement(HomePage));
  text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
});

describe("home page structure (W2, W3)", () => {
  it("has Design's sections in Design's order, with Try it kept after the learning loop", () => {
    const h2s = Array.from(html.matchAll(/<h2 id="([a-z-]+)"/g), (m) => m[1]);
    assert.deepEqual(h2s, ["steps-title", "tour-title", "loop-title", "try-it-title", "what-leaves-title", "pricing-title", "install-title", "faq-title"]);
    assert.match(html, /<h1 id="hero-title">/);
    assert.ok(html.indexOf('id="hero-title"') < html.indexOf('id="steps-title"'));
    assert.match(text, /Three steps, in any app\./);
    assert.match(text, /Then check it stuck\./);
    assert.match(text, /Download Unvibe\./);
  });

  it("shows the steps and the loop as plain rows of three, with no tabs or accordions", () => {
    assert.equal(html.match(/class="steps-row__step"/g)?.length, 3);
    assert.equal(html.match(/class="loop-cards__card"/g)?.length, 3);
    assert.doesNotMatch(html, /role="tab"|flexacc|aria-expanded="(true|false)"[^>]*class="flexacc/);
  });

  it("puts the demo behind Watch the demo and keeps every anchor other pages link to", () => {
    assert.match(html, /<details class="demo"><summary class="dl-card__other demo__button">[\s\S]*?Watch the demo/);
    for (const id of ["product", "tour", "try-it", "install"]) assert.match(html, new RegExp(`id="${id}"`), `#${id} is gone`);
  });

  it("answers four questions and drops the duplicate sections", () => {
    const faqStart = html.indexOf('class="paper-faq"');
    assert.equal(html.slice(faqStart, html.indexOf("</section>", faqStart)).match(/<summary>/g)?.length, 4);
    for (const gone of ['id="newsletter"', 'id="invite"', 'id="backing"', "Who it", "Four steps", "Where it"]) assert.ok(!html.includes(gone), gone);
    assert.match(text, /Unvibe is in Claude for Startups and \w+ other startup programs\./);
  });
});

describe("home page keeps Security's required disclosures (W2)", () => {
  it("what gets sent, and that keys are filtered on the device", () => {
    for (const item of SENT) assert.ok(text.includes(item), item);
    assert.ok(text.includes(KEPT[1]));
    assert.match(KEPT[1], /scans for them on your computer/);
  });

  it("names Anthropic's Claude API", () => {
    assert.match(text, /Anthropic's Claude API writes the explanation\./);
  });

  it("says AI can be wrong", () => {
    assert.match(text, /AI can be wrong, even when it sounds sure\./);
  });

  it("shows the pause line in Try it while NEXT_PUBLIC_AI_MAINTENANCE is on", () => {
    const start = html.indexOf('id="try-it"');
    const tryIt = html.slice(start, html.indexOf("</section>", start));
    assert.match(tryIt, /<p role="status">[^<]*paused[^<]*<\/p>/i);
  });

  it("links the privacy policy", () => {
    assert.match(html, /<a class="paper-text-link" href="\/privacy">Privacy policy<\/a>/);
  });
});
