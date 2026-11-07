import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderHome } from "./testRenderHome";
import { GLISSE_STYLES_ID, GlisseStylesMarker } from "@/components/glass/GlisseStylesMarker";

// tsx compiles JSX to React.createElement, so rendering components here needs React in scope.
Object.assign(globalThis, { React });

const layout = readFileSync("src/app/layout.tsx", "utf8");

describe("Glisse styles stay CSP-clean (Security, glisse 0.5.0 review finding 1)", () => {
  it("the marker Glisse checks before adding its own <style> is a <meta> with its id", () => {
    assert.equal(GLISSE_STYLES_ID, "glisse-styles");
    assert.equal(renderToStaticMarkup(createElement(GlisseStylesMarker)), '<meta id="glisse-styles" name="glisse-styles" content="bundled"/>');
  });

  it("the root layout renders the marker first in <head>, and adds no inline <style>", () => {
    const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
    assert.ok(head.includes("<GlisseStylesMarker />"), "marker in <head>");
    assert.ok(head.indexOf("<GlisseStylesMarker />") < head.indexOf("<script"), "marker before the head scripts");
    assert.doesNotMatch(layout, /<style\b/);
  });

  it("the layout bundles glisse/styles.css before the site's CSS and glass.css after it", () => {
    const at = (source: string) => layout.indexOf(`import "${source}";`);
    assert.ok(at("glisse/styles.css") >= 0 && at("glisse/styles.css") < at("./globals.css"));
    assert.ok(at("./glass.css") > at("./home-ux.css"));
  });
});

describe("home surfaces", () => {
  it("the analytics consent bar uses no Glisse component", () => {
    assert.doesNotMatch(readFileSync("src/components/AnalyticsConsentBar.tsx", "utf8"), /glisse/);
  });

  it("the hero's window is the HTML recreation under Security's caption, with no video, no toast and one H1", async () => {
    const html = await renderHome();
    const hero = html.slice(html.indexOf('<section class="d-hero"'), html.indexOf("</section>", html.indexOf('<section class="d-hero"')));
    assert.ok(hero.includes('class="d-win__frame"'), "the slice is the hero");
    assert.match(hero, /Unvibe 0\.1\.49 panel, recreated in HTML · sample code/);
    assert.doesNotMatch(hero, /<video\b/);
    assert.doesNotMatch(html, /Saved to your Library/);
    assert.equal(html.match(/<h1\b/g)?.length, 1);
    // The one glass header comes from the layout; a page never adds its own.
    assert.doesNotMatch(html, /<header\b/);
  });

  it("the layout mounts exactly one header, and no second glass bar", () => {
    assert.equal(layout.match(/<SiteHeader \/>/g)?.length, 1);
    assert.doesNotMatch(layout, /<Nav \/>|MobileDownloadBar|ScrollVibe/);
  });
});
