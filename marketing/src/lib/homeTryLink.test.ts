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
  const explain = [{ href: "/explain/git-diff", label: "Explain git diff output" }];
  const html = renderToStaticMarkup(createElement(Home, { copy: pricingCopy(false), faq: [], explain }));
  const links: Array<[string, string]> = [];
  const anchor = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  for (let m = anchor.exec(html); m; m = anchor.exec(html)) if (m[1].startsWith("/explain")) links.push([m[1], m[2]]);

  it("links the try text to plain /explain exactly once", () => {
    const tries = links.filter(([, inner]) => inner.includes(D_HERO.tryIt));
    assert.equal(tries.length, 1, `one try link on home, found ${tries.length}`);
    assert.equal(tries[0][0], "/explain");
  });

  it("never adds tracking parameters to an /explain link (the try link and the explain links row)", () => {
    assert.ok(links.length >= 3, `try link, the row's page link and its index link, found ${links.length}`);
    for (const [href] of links) assert.match(href, /^\/explain(\/[a-z0-9-]+)?$/, href);
  });

  it("puts the link under the H1, before the demo window", () => {
    const h1 = html.indexOf('id="d-hero-h"');
    const link = html.indexOf('href="/explain"');
    const demo = html.indexOf('class="d-win"');
    assert.ok(h1 >= 0 && link > h1 && demo > link, `order h1 ${h1} < link ${link} < demo ${demo}`);
  });
});
