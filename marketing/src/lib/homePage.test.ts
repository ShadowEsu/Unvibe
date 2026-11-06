import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/privacy/page";
import { KEYS } from "@/site/content";
import { Home } from "@/site/Home";
import { PricingBlock } from "@/site/parts";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const CLOSED_LINE = "Payments open soon. Nothing is billed today.";

describe("home price card", () => {
  it("says nothing is billed only while payments are closed", () => {
    assert.ok(text(renderToStaticMarkup(createElement(PricingBlock, { paymentsOpen: false, paused: false }))).includes(CLOSED_LINE));
    const open = text(renderToStaticMarkup(createElement(PricingBlock, { paymentsOpen: true, paused: false })));
    assert.ok(!open.includes(CLOSED_LINE), open);
    assert.match(open, /Free for Mac and Windows\./);
  });

  it("links to /pricing in both states", () => {
    for (const paymentsOpen of [false, true]) {
      assert.match(renderToStaticMarkup(createElement(PricingBlock, { paymentsOpen, paused: false })), /<a class="lx-link sx-link" href="\/pricing">Pricing<\/a>/);
    }
  });

  it("carries the Try box's pause note while hosted AI is paused (Security SHOULD-H3), not otherwise", () => {
    assert.match(renderToStaticMarkup(createElement(PricingBlock, { paymentsOpen: false, paused: true })), /role="status">AI features are paused for maintenance\. Back soon\.<\/p><\/div>$/);
    assert.doesNotMatch(renderToStaticMarkup(createElement(PricingBlock, { paymentsOpen: false, paused: false })), /paused/);
  });
});

describe("home page", () => {
  const html = renderToStaticMarkup(createElement(Home, { paymentsOpen: false }));

  // Other pages, the palette, the phone bar and emails link to these (/#email-link, /#install, /#try-it, /#see-it).
  it("keeps the anchors the rest of the site links to", () => {
    for (const id of ["email-link", "install", "try-it", "see-it", "product", "faq"]) assert.match(html, new RegExp(` id="${id}"`), id);
  });

  it("gives each install box its own command-group name", () => {
    const ids = Array.from(html.matchAll(/class="ninst__title" id="([^"]+)"/g), (match) => match[1]);
    assert.ok(ids.length >= 2, `${ids.length} install boxes`);
    assert.equal(new Set(ids).size, ids.length, ids.join(", "));
    for (const id of ids) assert.match(html, new RegExp(`role="group" aria-labelledby="${id}"`));
  });

  it("makes only key-check claims the privacy page backs", () => {
    const privacy = text(renderToStaticMarkup(createElement(PrivacyPage)));
    assert.ok(text(html).includes(KEYS.h2) && text(html).includes(KEYS.lede));
    assert.ok(privacy.includes("scanned on your computer before they are sent"));
    assert.ok(privacy.includes("A known credential blocks the request"));
    assert.match(html, /<a class="lx-link sx-link" href="\/privacy">What leaves your computer<\/a>/);
  });
});
