import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRICING } from "./pricing";
import { pricingCopy, type PricingCopy } from "./pricingCopy";

function allText(copy: PricingCopy): string {
  return [
    copy.heading.lead, copy.heading.emphasis, copy.heading.tail, copy.description, copy.disclosure, copy.termsNote ?? "",
    ...copy.plans.flatMap((plan) => [plan.badge, plan.eyebrow, plan.detail, plan.cta, ...plan.features]),
  ].join("\n");
}

describe("pricing copy while payments are closed", () => {
  const closed = pricingCopy(false);
  const text = allText(closed);

  it("promises no upgrade, checkout or renewal", () => {
    assert.doesNotMatch(text, /upgrade|renew|plan page|checkout|\bbuy\b|subscribe|cancel|lifetime/i);
  });

  it("says Pro and Teams open soon and Free works today", () => {
    assert.match(closed.heading.lead + closed.heading.emphasis + closed.heading.tail, /^Start free today\. Pro and Teams open soon\.$/);
    const pro = closed.plans.find((plan) => plan.id === "pro");
    assert.equal(pro?.detail, "One developer account. Pro opens soon. Your Free plan keeps working until then.");
    assert.match(closed.plans.find((plan) => plan.id === "teams")?.detail ?? "", /Teams opens soon/);
    assert.match(closed.disclosure, /not on sale yet, so nothing is billed today/);
    assert.match(closed.termsNote ?? "", /^Pro and Teams are not on sale yet\. Until they open, nothing is billed and your Free plan keeps working\.$/);
  });

  it("keeps the real prices visible", () => {
    assert.match(closed.description, new RegExp(`\\$${PRICING.proMonthly} a month or \\$${PRICING.proAnnual} a year`));
    assert.match(closed.description, new RegExp(`\\$${PRICING.teamsSeatMonthly} per seat per month`));
  });

  it("has no button that leads to a dead end", () => {
    for (const plan of closed.plans) assert.ok(plan.href === "/beta" || plan.href.startsWith("mailto:preston@unvibe.site"), plan.id);
    assert.equal(closed.plans.find((plan) => plan.id === "pro")?.cta, "Download free");
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

    it(`states no allowance numbers (payments ${paymentsOpen ? "open" : "closed"})`, () => {
      const text = allText(copy);
      assert.doesNotMatch(text, /\d+\s*(ai\s+)?(explanations|questions|projects|items|reviews)/i);
      assert.ok(copy.plans.find((plan) => plan.id === "pro")?.features.includes("More explanations each month than Free"));
    });
  }
});

describe("pricing copy once payments open", () => {
  const open = pricingCopy(true);

  it("keeps today's wording", () => {
    assert.equal(`${open.heading.lead}${open.heading.emphasis}${open.heading.tail}`, "Start free. Upgrade when it earns a place in your day.");
    assert.equal(open.heading.emphasis, "earns a place");
    assert.equal(open.description, `Download Unvibe free. Pro is $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year and adds Expert depth, git diffs and nearby-file context. Teams is a founding pilot at $${PRICING.teamsSeatMonthly} per seat per month.`);
    assert.equal(open.disclosure, "Prices in USD. Pro and Teams renew until you cancel. “Founding pilot” means early access, not general availability. Explanation text is not shared across seats.");
    assert.equal(open.termsNote, null);
    assert.deepEqual(open.plans.map((plan) => [plan.id, plan.badge, plan.detail, plan.cta, plan.href]), [
      ["free", "No card needed", "Included AI explanations with a usage limit. No card and no separate API key.", "Download free", "/beta"],
      ["pro", "Individual", "One developer account. Upgrade, manage or cancel from the Plan page in the app.", "Download, then upgrade", "/beta"],
      ["teams", "Founding pilot", `Founding price. ${PRICING.teamsMinSeats} to ${PRICING.teamsMaxSeats} seats. Each person keeps their explanations on their own computer.`, "Request Teams seats", open.plans[2].href],
    ]);
    assert.match(open.plans[2].href, /^mailto:preston@unvibe\.site\?subject=Unvibe%20Teams%20founding%20pilot/);
  });

  it("shares features and the featured card with the closed copy", () => {
    const closed = pricingCopy(false);
    assert.deepEqual(open.plans.map((plan) => [plan.id, plan.name, plan.eyebrow, plan.features, plan.featured]), closed.plans.map((plan) => [plan.id, plan.name, plan.eyebrow, plan.features, plan.featured]));
  });
});
