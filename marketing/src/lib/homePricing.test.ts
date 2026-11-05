import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import { FREE_MONTHLY_ALLOWANCE, PRO_MONTHLY_ALLOWANCE, SIGNED_OUT_ALLOWANCE } from "./allowance";
import { PRICING } from "./pricing";
import { HomePricing } from "@/components/paper/HomePricing";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

const html = renderToStaticMarkup(createElement(HomePage));
const start = html.indexOf('id="pricing"');
const strip = html.slice(start, html.indexOf("</section>", start));
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const plans = strip.slice(0, strip.indexOf('class="n-note nprice__teams"')).split('<div class="nprice__plan');
const pro = plans.find((plan) => plan.includes("<h3>Pro</h3>")) ?? "";

describe("home price strip (W5)", () => {
  it("is on the home page with Design's heading", () => {
    assert.ok(start > 0, "no #pricing section on home");
    assert.match(strip, /<h2 id="pricing-title">Free while in beta\. Pro opens soon\.<\/h2>/);
    assert.match(text(strip), /No card and no API key\./);
  });

  it("states the real allowances and prices, with the counting digits hidden from assistive tech", () => {
    assert.ok(text(strip).includes(`${SIGNED_OUT_ALLOWANCE}. Sign in for ${FREE_MONTHLY_ALLOWANCE}.`));
    for (const value of [PRICING.proMonthly, PRICING.proAnnual]) assert.ok(pro.includes(`aria-label="${value}"`), `price ${value} is labelled`);
    assert.ok(text(pro).includes(`$${PRICING.proMonthly} a month, or $${PRICING.proAnnual} a year`));
    assert.ok(text(pro).includes(PRO_MONTHLY_ALLOWANCE));
    assert.match(text(pro), /Not on sale yet\. Your Free plan keeps working until then\./);
  });

  it("gives Pro no button or link, since nothing can be bought", () => {
    assert.ok(pro, "no Pro plan");
    assert.doesNotMatch(pro, /<a\b|<button\b/);
    assert.match(strip, /<a class="nprice__all" href="\/pricing">See all plans<\/a>/);
  });
});

describe("home price strip while hosted AI is paused (Security SHOULD-H3)", () => {
  it("shows the Try box's pause note under the plans when the switch is on", () => {
    const on = renderToStaticMarkup(createElement(HomePricing, { paused: true }));
    assert.match(on, /role="status">AI features are paused for maintenance\. Back soon\.<\/p><\/section>$/);
  });

  it("shows no pause note when the switch is off", () => {
    const off = renderToStaticMarkup(createElement(HomePricing, { paused: false }));
    assert.doesNotMatch(off, /paused/);
  });
});
