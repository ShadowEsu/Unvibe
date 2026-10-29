import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NewsletterSignup } from "@/components/paper/NewsletterSignup";
import { DownloadForThisComputer } from "@/components/paper/PhotoHero";

Object.assign(globalThis, { React });

const sections = readFileSync("src/app/sections.css", "utf8");
const hero = readFileSync("src/app/hero.css", "utf8");
const pages = readFileSync("src/app/pages.css", "utf8");

function rule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} has a rule`);
  return css.slice(start, css.indexOf("}", start) + 1);
}

describe("post-release site details", () => {
  it("keeps each newsletter label connected to an unticked, first-line-aligned 20 px ink checkbox", () => {
    for (const id of ["footer", "home", "about"]) {
      const markup = renderToStaticMarkup(createElement(NewsletterSignup, { id }));
      assert.match(markup, new RegExp(`<input type="checkbox" id="newsletter-${id}-consent"`));
      assert.match(markup, new RegExp(`<label for="newsletter-${id}-consent">[^<]+</label>`));
      assert.doesNotMatch(markup, /\bchecked(?:=|\s|\/?>)/);
    }
    const checkbox = rule(sections, ".newsletter__consent input");
    assert.match(checkbox, /width: 20px; height: 20px; margin: 2px 0 0; accent-color: var\(--ink\)/);
    assert.match(rule(sections, ".newsletter__consent"), /display: flex; align-items: flex-start/);
    assert.match(rule(sections, ".newsletter__consent label"), /min-height: 24px; cursor: pointer/);
  });

  it("underlines only the programs total and gives the mobile count and trust items separator-free lines", () => {
    assert.match(rule(hero, ".vhero__backing a"), /text-decoration: none/);
    assert.match(rule(hero, ".vhero__backing b"), /text-decoration: underline/);
    assert.match(rule(hero, ".vhero__backing-programs"), /text-decoration: none/);
    assert.match(hero, /@media \(max-width: 480px\) \{\s*\.vhero__backing-programs, \.vhero__trust-item \{ display: block; \}\s*\.vhero__backing-separator, \.vhero__trust-separator \{ display: none; \}/);
    const markup = renderToStaticMarkup(createElement(DownloadForThisComputer, { device: "mac", actionsRef: { current: null } }));
    assert.equal(Array.from(markup.matchAll(/class="vhero__trust-item"/g)).length, 4);
    assert.equal(Array.from(markup.matchAll(/class="vhero__trust-separator"/g)).length, 3);
    assert.match(markup, /<span class="vhero__trust-separator">· <\/span>Keys and tokens filtered on your computer/);
  });

  it("caps the home pills and keeps the programs subheading below the section heading scale", () => {
    assert.match(rule(sections, ".paper-backing .program-list__items"), /max-width: 50rem; margin-inline: auto/);
    assert.match(rule(sections, ".paper-backing .claude-startups__title"), /font-size: 32px/);
  });

  it("gives about lists card body sizing, no indent and 9 px gaps", () => {
    const list = rule(pages, ".founder-about__card ul");
    for (const declaration of ["display: grid", "gap: 9px", "padding: 0", "list-style: none", "font-size: 18px"]) {
      assert.ok(list.includes(declaration), declaration);
    }
  });

  it("shares footer link and analytics button row height, alignment and padding", () => {
    assert.match(rule(sections, ".paper-footer nav a, .paper-footer nav .paper-footer__settings"), /display: flex; align-items: center; min-height: 2\.75rem; padding: 0/);
  });

  it("leaves the activation agreement note tucked under the boxes with 14 px below", () => {
    const activate = readFileSync("../web/app/activate/activate.css", "utf8");
    assert.match(rule(activate, ".activate-agree .activate-note"), /margin: -2px 0 14px/);
  });
});
