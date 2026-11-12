import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pricingCopy } from "@/lib/pricingCopy";
import { Home } from "@/site/dia/Home";
import { D_HERO } from "@/site/dia/content";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

describe("home: the browser-try link under the tagline (Design 2032, Security MUST-T1)", () => {
  const html = renderToStaticMarkup(createElement(Home, { copy: pricingCopy(false), faq: [] }));

  it("links the try text to plain /explain exactly once, with no tracking parameters", () => {
    const links: Array<[string, string]> = [];
    const anchor = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    for (let m = anchor.exec(html); m; m = anchor.exec(html)) if (m[1].startsWith("/explain")) links.push([m[1], m[2]]);
    assert.equal(links.length, 1, `one /explain link on home, found ${links.length}`);
    const [href, inner] = links[0];
    assert.equal(href, "/explain");
    assert.ok(inner.includes(D_HERO.tryIt), "the link carries the GO'd text");
  });

  it("puts the link under the H1, before the demo window", () => {
    const h1 = html.indexOf('id="d-hero-h"');
    const link = html.indexOf('href="/explain"');
    const demo = html.indexOf('class="d-win"');
    assert.ok(h1 >= 0 && link > h1 && demo > link, `order h1 ${h1} < link ${link} < demo ${demo}`);
  });
});
