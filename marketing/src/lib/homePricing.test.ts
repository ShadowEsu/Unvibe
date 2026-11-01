import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import { FREE_MONTHLY_ALLOWANCE, PRO_MONTHLY_ALLOWANCE, SIGNED_OUT_ALLOWANCE } from "./allowance";
import { PRICING } from "./pricing";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

const html = renderToStaticMarkup(createElement(HomePage));
const start = html.indexOf('id="pricing"');
const strip = html.slice(start, html.indexOf("</section>", start));
const pro = strip.slice(strip.indexOf("plans-strip__card--pro"), strip.indexOf("plans-strip__foot"));

describe("home price strip (W5)", () => {
  it("is on the home page with Design's heading", () => {
    assert.ok(start > 0, "no #pricing section on home");
    assert.match(strip, /Free while in beta\. <em>Pro opens soon\.<\/em>/);
  });

  it("states the real allowances and prices", () => {
    assert.ok(strip.includes(`${SIGNED_OUT_ALLOWANCE}. Sign in for ${FREE_MONTHLY_ALLOWANCE}.`));
    assert.ok(pro.includes(`$${PRICING.proMonthly} <small>a month, or $${PRICING.proAnnual} a year</small>`));
    assert.ok(pro.includes(PRO_MONTHLY_ALLOWANCE));
    assert.match(pro, /Not on sale yet\. Your Free plan keeps working until then\./);
  });

  it("gives Pro no button or link, since nothing can be bought", () => {
    assert.doesNotMatch(pro, /<a\b|<button\b/);
    assert.match(strip, /also opens soon\. <a class="paper-text-link" href="\/pricing">See all plans<\/a>/);
  });
});
