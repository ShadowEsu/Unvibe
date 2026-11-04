import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import { GlassPlate } from "@/components/glass/GlassPlate";
import { GLISSE_STYLES_ID, GlisseStylesMarker } from "@/components/glass/GlisseStylesMarker";
import { glassLevelFrom } from "./glassLevel";

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

describe("glass level (branch-only ?glass= switch)", () => {
  it("reads subtle or full from the query and defaults to full", () => {
    assert.equal(glassLevelFrom("?glass=subtle"), "subtle");
    assert.equal(glassLevelFrom("?glass=full"), "full");
    assert.equal(glassLevelFrom(""), "full");
    assert.equal(glassLevelFrom("?glass=SUBTLE&x=1"), "full");
  });
});

describe("glass plates", () => {
  it("are decoration only: an empty aria-hidden Glisse Glass", () => {
    assert.equal(renderToStaticMarkup(createElement(GlassPlate)), '<div class="lg-glass glass-plate" aria-hidden="true"></div>');
  });

  it("never sit under consent text: the Try it and newsletter sheets and the analytics bar have no glass", () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    for (const id of ["try-it", "newsletter"]) {
      const start = html.indexOf(`id="${id}"`);
      assert.ok(start > 0, `#${id} is on home`);
      assert.doesNotMatch(html.slice(start, html.indexOf("</section>", start)), /glass-plate/, `#${id} has no plate`);
    }
    assert.doesNotMatch(readFileSync("src/components/AnalyticsConsentBar.tsx", "utf8"), /glisse|GlassPlate/);
  });
});
