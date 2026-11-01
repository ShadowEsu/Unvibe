import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResourcesHub } from "@/components/paper/ResourcesHub";

Object.assign(globalThis, { React });

describe("/resources exchanged link", () => {
  it("links Top10AI once, marked sponsored, with the agreed anchor", () => {
    const html = renderToStaticMarkup(createElement(ResourcesHub));
    const links = html.match(/<a[^>]*href="https:\/\/top10ai\.com\/?"[^>]*>[^<]*<\/a>/g) ?? [];
    assert.equal(links.length, 1, "exactly one Top10AI link");
    assert.match(links[0], /\srel="sponsored"/);
    assert.match(links[0], />Top10AI<\/a>$/);
  });
});
