import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PricingPlans } from "@/components/redesign/PricingPlans";
import { BUSINESS_RATE_LIMIT_LINE, FAIR_USE_HREF, FAIR_USE_LABEL } from "./pricing";
import { pricingCopy } from "./pricingCopy";

// tsx compiles JSX to React.createElement, so rendering components here needs React in scope.
Object.assign(globalThis, { React });

/** The text a browser reads from rendered markup: tags dropped, the entities React writes decoded. */
function textContent(html: string): string {
  return html.replace(/<[^>]+>/g, "").replaceAll("&#x27;", "'").replaceAll("&quot;", "\"").replaceAll("&amp;", "&");
}

/** The inner markup of one card's allowance paragraph. */
function allowanceMarkup(html: string, id: string): string {
  const card = html.split(`id="${id}"`)[1]?.split("</article>")[0] ?? "";
  const match = /<p class="marketing-plan-allowance">([\s\S]*?)<\/p>/.exec(card);
  assert.ok(match, `${id} allowance paragraph`);
  return match[1];
}

// Design P2 1: the Big Business offer at allowance weight, its rate limit on its own line at regular
// weight. Only weight and line placement change: the words and the one paragraph stay as they are.
describe("plan cards", () => {
  for (const paymentsOpen of [false, true]) {
    const html = renderToStaticMarkup(createElement(PricingPlans, { paymentsOpen }));

    it(`Big Business: the paragraph reads exactly the allowance; only the rate limit is in the regular-weight span (${paymentsOpen ? "open" : "closed"})`, () => {
      const business = pricingCopy(paymentsOpen).plans.find((plan) => plan.id === "business");
      assert.ok(business?.allowanceLimit);
      assert.equal(business.allowanceLimit, `under a ${BUSINESS_RATE_LIMIT_LINE}`);
      assert.ok(business.allowance.endsWith(business.allowanceLimit), "the limit is the end of the allowance");
      const markup = allowanceMarkup(html, "business");
      assert.equal(textContent(markup), business.allowance, "textContent is the allowance, word for word");
      const [head, limit] = markup.split('<span class="marketing-plan-allowance-limit">');
      assert.equal(textContent(head), "Up to 10 named seats, unlimited explanations and questions, ");
      assert.equal(textContent(limit), business.allowanceLimit);
      assert.ok(limit.includes(`<a href="${FAIR_USE_HREF}">${FAIR_USE_LABEL}</a>`), "the link stays on the label, once");
      assert.equal(markup.split("<a ").length, 2);
    });

    it(`every other card renders its allowance as plain text, with no limit span (${paymentsOpen ? "open" : "closed"})`, () => {
      for (const plan of pricingCopy(paymentsOpen).plans.filter((item) => item.id !== "business")) {
        assert.equal(plan.allowanceLimit, null, plan.id);
        const markup = allowanceMarkup(html, plan.id);
        assert.equal(textContent(markup), plan.allowance, plan.id);
        assert.doesNotMatch(markup, /<span|<a /, plan.id);
      }
    });
  }
});
