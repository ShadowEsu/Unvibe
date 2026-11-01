import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PricingPlans } from "@/components/redesign/PricingPlans";
import { PRICING } from "./pricing";
import { pricingCopy, type PricingCopy } from "./pricingCopy";

Object.assign(globalThis, { React });

/** The rendered /pricing card for one plan, from its article tag to the next. */
function planCard(paymentsOpen: boolean, id: string): string {
  const markup = renderToStaticMarkup(createElement(PricingPlans, { paymentsOpen }));
  const start = markup.indexOf(`<article id="${id}"`);
  assert.ok(start >= 0, `no card ${id}`);
  return markup.slice(start, markup.indexOf("</article>", start));
}

function allText(copy: PricingCopy): string {
  return [
    copy.heading.lead, copy.heading.emphasis, copy.heading.tail, copy.description, copy.disclosure, copy.termsNote ?? "",
    ...copy.plans.flatMap((plan) => [plan.badge, plan.eyebrow, plan.note ?? "", plan.detail, plan.cta ?? "", plan.after ?? "", ...plan.features]),
  ].join("\n");
}

describe("pricing copy while payments are closed", () => {
  const closed = pricingCopy(false);
  const text = allText(closed);

  it("promises no upgrade, checkout or renewal", () => {
    assert.doesNotMatch(text, /upgrade|renew|plan page|checkout|\bbuy\b|subscribe|cancel|lifetime/i);
  });

  it("says 'soon' once, in the heading, and each paid card says Not on sale yet", () => {
    assert.match(closed.heading.lead + closed.heading.emphasis + closed.heading.tail, /^Start free today\. Pro and Teams open soon\.$/);
    const page = renderToStaticMarkup(createElement(PricingPlans, { paymentsOpen: false })).replace(/<[^>]+>/g, " ");
    assert.equal(page.match(/soon/gi)?.length, 1, page);
    for (const id of ["pro", "teams"]) assert.match(planCard(false, id), /<p class="plan-note">Not on sale yet<\/p>/, id);
    assert.equal(closed.plans.find((plan) => plan.id === "pro")?.detail, "One developer account. Your Free plan keeps working until then.");
    assert.match(closed.disclosure, /not on sale yet, so nothing is billed today/);
    assert.match(closed.termsNote ?? "", /^Pro and Teams are not on sale yet\. Until they open, nothing is billed and your Free plan keeps working\.$/);
  });

  it("has no Monthly/Annual toggle; each paid card states both prices in one line", () => {
    const markup = renderToStaticMarkup(createElement(PricingPlans, { paymentsOpen: false }));
    assert.doesNotMatch(markup, /radiogroup|pricing-toggle/);
    const line = (id: string) => planCard(false, id).replace(/<[^>]+>/g, "").match(/\$\d+ a (seat a )?month, or \$\d+ a year/)?.[0];
    assert.equal(line("pro"), `$${PRICING.proMonthly} a month, or $${PRICING.proAnnual} a year`);
    assert.equal(line("teams"), `$${PRICING.teamsSeatMonthly} a seat a month, or $${PRICING.teamsSeatAnnual} a year`);
    assert.match(renderToStaticMarkup(createElement(PricingPlans, { paymentsOpen: true })), /role="radiogroup" aria-label="Billing interval"/);
  });

  it("keeps the real prices visible", () => {
    assert.match(closed.description, new RegExp(`\\$${PRICING.proMonthly} a month or \\$${PRICING.proAnnual} a year`));
    assert.match(closed.description, /; payments open soon\.$/);
  });

  it("has no button that leads to a dead end", () => {
    for (const plan of closed.plans) {
      if (plan.href === null) continue;
      assert.ok(plan.href === "/beta" || plan.href.startsWith("mailto:hello@unvibe.site"), plan.id);
    }
  });

  it("gives the Pro card no button, says it isn't on sale and how to try it today", () => {
    const pro = planCard(false, "pro");
    assert.doesNotMatch(pro, /<a |<button/);
    assert.match(pro, /<p class="plan-note">Not on sale yet<\/p>/);
    assert.match(pro, /<p class="plan-after">Try Pro today: a new account gets a free month, and each friend you invite adds one\.<\/p>/);
    // Free keeps its download, Teams its email.
    assert.match(planCard(false, "free"), /href="\/beta"[^>]*>.*Download free/);
    assert.match(planCard(false, "teams"), /href="mailto:hello@unvibe\.site/);
  });

  it("keeps the Pro button once payments open", () => {
    assert.match(planCard(true, "pro"), /href="\/beta"[^>]*>.*Download, then upgrade/);
  });

  it("follows the copy rules", () => {
    assert.doesNotMatch(text, /[—–]/);
    assert.doesNotMatch(text, /founder|I built/i);
  });
});

describe("pricing copy in both states", () => {
  for (const paymentsOpen of [false, true]) {
    const copy = pricingCopy(paymentsOpen);

    it(`has one filled button, Download free (payments ${paymentsOpen ? "open" : "closed"})`, () => {
      assert.deepEqual(copy.plans.filter((plan) => plan.primary).map((plan) => [plan.id, plan.cta, plan.href]), [["free", "Download free", "/beta"]]);
    });

    it(`states the allowances from lib/allowance (payments ${paymentsOpen ? "open" : "closed"})`, () => {
      const plans = Object.fromEntries(copy.plans.map((plan) => [plan.id, plan]));
      assert.equal(plans.free.detail, "50 explanations in your first 30 days without signing in, then 50 explanations a month when you sign in. No card and no separate API key.");
      assert.ok(plans.pro.features.includes("100 explanations a month"));
      assert.doesNotMatch(allText(copy), /usage limit|More explanations each month/i);
    });
  }

  it("lists Briefs and Why does this exist? as Free; Pro adds only the AI explanation of diffs and Briefs", () => {
    const plans = pricingCopy(false).plans;
    const free = plans.find((plan) => plan.id === "free")?.features ?? [];
    const pro = plans.find((plan) => plan.id === "pro")?.features ?? [];
    assert.ok(free.includes("Briefs of your Git changes, made on your computer"));
    assert.ok(free.includes("“Why does this exist?” from your Git history"));
    assert.ok(pro.includes("AI explanations of Git diffs and change Briefs"));
    for (const feature of pro) if (/brief|diff/i.test(feature)) assert.match(feature, /^AI explanations of /, feature);
  });

  it("gives search results a description that fits and keeps retired Teams wording out", () => {
    for (const paymentsOpen of [false, true]) {
      const { description } = pricingCopy(paymentsOpen);
      assert.ok(description.length <= 160, `${description.length} characters: ${description}`);
      assert.doesNotMatch(description, /founding pilot|Teams/i);
    }
  });
});

describe("pricing copy once payments open", () => {
  const open = pricingCopy(true);

  it("keeps today's wording", () => {
    assert.equal(`${open.heading.lead}${open.heading.emphasis}${open.heading.tail}`, "Start free. Upgrade when it earns a place in your day.");
    assert.equal(open.heading.emphasis, "earns a place");
    assert.match(open.description, new RegExp(`\\$${PRICING.proMonthly} a month or \\$${PRICING.proAnnual} a year\\.$`));
    assert.doesNotMatch(open.description, /open soon/);
    assert.equal(open.disclosure, "Prices in USD. Pro and Teams renew until you cancel. “Founding pilot” means early access, not general availability. Explanation text is not shared across seats.");
    assert.equal(open.termsNote, null);
    assert.deepEqual(open.plans.map((plan) => [plan.id, plan.badge, plan.detail, plan.cta, plan.href]), [
      ["free", "No card needed", open.plans[0].detail, "Download free", "/beta"],
      ["pro", "Individual", "One developer account. Upgrade, manage or cancel from the Plan page in the app.", "Download, then upgrade", "/beta"],
      ["teams", "Founding pilot", `Founding price. ${PRICING.teamsMinSeats} to ${PRICING.teamsMaxSeats} seats. Each person keeps their explanations on their own computer.`, "Request Teams seats", open.plans[2].href],
    ]);
    assert.match(open.plans[2].href ?? "", /^mailto:hello@unvibe\.site\?subject=Unvibe%20Teams%20founding%20pilot/);
  });

  it("shares features and the featured card with the closed copy", () => {
    const closed = pricingCopy(false);
    assert.deepEqual(open.plans.map((plan) => [plan.id, plan.name, plan.eyebrow, plan.features, plan.featured]), closed.plans.map((plan) => [plan.id, plan.name, plan.eyebrow, plan.features, plan.featured]));
  });
});
