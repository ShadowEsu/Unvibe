import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NotFound, { metadata } from "@/app/not-found";

Object.assign(globalThis, { React });

describe("the page-not-found page", () => {
  const markup = renderToStaticMarkup(createElement(NotFound));
  const visible = markup.replace(/<p class="nf__code"[\s\S]*?<\/p>/, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

  it("says what happened without blaming, jargon or a joke heading", () => {
    assert.match(markup, /<h1>We can&#x27;t find that page\.<\/h1>/);
    assert.match(visible, /Check the address, or try one of these\./);
    assert.doesNotMatch(visible, /404|oops|vibe coded out of existence/i);
    assert.equal(metadata.title, "Page not found");
  });

  it("offers the likely destinations and the site search", () => {
    const links = Array.from(markup.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g), (match) => [match[2], match[1]]);
    assert.deepEqual(links, [["Download", "/beta"], ["Help", "/help"], ["Install help", "/install-help"], ["Pricing", "/pricing"], ["Changelog", "/releases"]]);
    assert.match(visible, /Press ⌘K or Ctrl\+K to search the site\./);
  });

  it("keeps the code joke only as a hidden aside under the links", () => {
    assert.match(markup, /<\/ul>[\s\S]*<p class="nf__code" aria-hidden="true">/);
  });
});
