import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import { GlassPlate } from "@/components/glass/GlassPlate";
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

describe("glass plates", () => {
  it("are decoration only: an empty aria-hidden Glisse Glass", () => {
    assert.equal(renderToStaticMarkup(createElement(GlassPlate)), '<div class="lg-glass glass-plate" aria-hidden="true"></div>');
  });

  it("never sit under consent or long reading text: the Try it, What leaves and FAQ sections and the analytics bar have no glass", () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    for (const marker of ['id="try-it"', 'id="what-leaves"', 'aria-labelledby="faq-title"']) {
      const start = html.indexOf(marker);
      assert.ok(start > 0, `${marker} is on home`);
      assert.doesNotMatch(html.slice(start, html.indexOf("</section>", start)), /glass-plate/, `${marker} has no plate`);
    }
    assert.doesNotMatch(readFileSync("src/components/AnalyticsConsentBar.tsx", "utf8"), /glisse|GlassPlate/);
  });

  it("one layer only: a plate is never inside another plated surface", () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    // A section sheet carries no plate of its own; plates sit on cards and panels inside it.
    assert.doesNotMatch(html, /class="paper-wrap u-sheet[^"]*"><div class="lg-glass glass-plate"/);
    assert.match(html, /<figure class="vhero__still"><div class="lg-glass glass-plate" aria-hidden="true"><\/div><img/);
  });

  it("the hero still is the real 0.1.48 frame with its size and a description", () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    const still = html.slice(html.indexOf('<figure class="vhero__still">'), html.indexOf("</figure>"));
    assert.match(still, /src="\/product\/unvibe-0148-debounce-1180\.webp"/);
    assert.match(still, /width="1180" height="846"/);
    assert.match(still, /alt="Unvibe 0\.1\.48 explaining a debounce function beside the code\."/);
  });
});
