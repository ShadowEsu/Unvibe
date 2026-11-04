import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("standalone text link targets", () => {
  const css = readFileSync(new URL("../app/sections.css", import.meta.url), "utf8");
  const rule = css.match(/([^{}]+)\{\s*display: inline-block;\s*padding-block: 6px;\s*line-height: 20px;\s*\}/);

  it("are 32 px tall: 20 px of line plus 6 px above and below", () => {
    assert.ok(rule, "the padded link rule is missing");
  });

  it("cover the links Design measured under 24 px", () => {
    const selectors = (rule?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "").split(",").map((selector) => selector.trim());
    for (const selector of [
      ".home-langs .paper-text-link",
      ".beta-page__steps-list p > a.paper-text-link",
      ".paper-beta__update > a",
      ".paper-invite__card .paper-caption > a",
    ]) assert.ok(selectors.includes(selector), selector);
  });
});
