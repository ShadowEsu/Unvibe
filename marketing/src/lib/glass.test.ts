import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
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

  it("the hero's demo window shows the real panel capture with its size and a description", () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    const panel = html.slice(html.indexOf('<div class="ndemo__panel">'), html.indexOf('<div class="ndemo__cover"'));
    assert.match(panel, /src="\/unvibe\/real\/panel-explained-top\.webp"/);
    assert.match(panel, /width="880" height="1131"/);
    assert.match(panel, /alt="The Unvibe panel explaining a JavaScript debounce function, with depth buttons along the top"/);
  });
});
