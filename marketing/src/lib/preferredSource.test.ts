import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PREFERRED_SOURCE_BADGE, PREFERRED_SOURCE_HREF, PreferredSourceLink } from "@/components/paper/PreferredSource";

Object.assign(globalThis, { React });

describe("Google preferred sources deeplink", () => {
  it("is a plain link to Google's source tool for unvibe.site, opening in a new tab with rel=noopener", () => {
    assert.equal(PREFERRED_SOURCE_HREF, "https://www.google.com/preferences/source?q=unvibe.site");
    const markup = renderToStaticMarkup(createElement(PreferredSourceLink));
    assert.match(markup, /^<a href="https:\/\/www\.google\.com\/preferences\/source\?q=unvibe\.site" target="_blank" rel="noopener" class="paper-preferred-source">/);
    assert.doesNotMatch(markup, /<button|<script|nofollow|sponsored/);
  });

  it("shows Google's badge from unvibe.site, with its size set and an alt that names Unvibe", () => {
    const markup = renderToStaticMarkup(createElement(PreferredSourceLink));
    assert.ok(PREFERRED_SOURCE_BADGE.src.startsWith("/badges/"), PREFERRED_SOURCE_BADGE.src);
    assert.ok(existsSync(path.join("public", PREFERRED_SOURCE_BADGE.src)), `public${PREFERRED_SOURCE_BADGE.src} is missing`);
    assert.match(markup, /<img src="\/badges\/google-preferred-source-light\.png" alt="Add Unvibe as a preferred source on Google" width="676" height="213"/);
  });

  it("sits in the footer and on the change log, and nothing loads Google's button script", () => {
    for (const file of ["src/components/Footer.tsx", "src/app/releases/page.tsx"]) {
      const source = readFileSync(file, "utf8");
      assert.match(source, /<PreferredSourceLink\b/, file);
      assert.doesNotMatch(source, /news\.google\.com\/swg|google-add-preferred-source-btn/, file);
    }
  });
});
