import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { faqItems } from "../data/faq";
import { FREE_USE_NOTE } from "../emails/betaShared";
import { betaWindowsInstallScript } from "./betaInstallScript";
import { kitMarkdown } from "./kit";
import { BUSINESS_FAIR_USE, EXPLANATIONS_PER_MONTH, FAIR_USE_HREF, FREE_LINE, PRICING } from "./pricing";
import { FAIR_USE, PAYMENTS_OPEN_SOON, TERMS_NEW_TIERS, pricingCopy, type PlanCopy, type PricingCopy } from "./pricingCopy";

const srcRoot = fileURLToPath(new URL("..", import.meta.url));
const source = (...parts: string[]) => readFileSync(join(srcRoot, ...parts), "utf8");

function planText(plan: PlanCopy): string[] {
  return [plan.name, plan.badge, plan.eyebrow, plan.price, plan.allowance, plan.detail, plan.cta, plan.note ?? "", ...plan.features];
}

function allText(copy: PricingCopy): string {
  return [copy.heading.lead, copy.heading.emphasis, copy.heading.tail, copy.description, copy.disclosure, copy.termsNote ?? "", ...copy.plans.flatMap(planText)].join("\n");
}

const plan = (copy: PricingCopy, id: PlanCopy["id"]): PlanCopy => {
  const found = copy.plans.find((item) => item.id === id);
  assert.ok(found, id);
  return found;
};

const STATES = [false, true] as const;
const label = (paymentsOpen: boolean) => `payments ${paymentsOpen ? "open" : "closed"}`;

/** Pricing, FAQ and Terms copy, in both payment states. */
const PUBLIC_COPY = [
  ...STATES.map((paymentsOpen) => allText(pricingCopy(paymentsOpen))),
  FAIR_USE.heading, FAIR_USE.limit, FAIR_USE.enforcement, TERMS_NEW_TIERS,
  ...faqItems.flatMap((item) => [item.question, item.answer]),
].join("\n");

describe("the plan lineup", () => {
  it("is Free, Pro, Enterprise and Big Business at the settled prices", () => {
    assert.deepEqual(PRICING, { proMonthly: 9, proAnnual: 81, annualDiscountPercent: 25, enterpriseMonthly: 50, businessOnce: 5000 });
    for (const paymentsOpen of STATES) {
      const copy = pricingCopy(paymentsOpen);
      assert.deepEqual(copy.plans.map((item) => [item.id, item.name]), [["free", "Free"], ["pro", "Pro"], ["enterprise", "Enterprise"], ["business", "Big Business"]], label(paymentsOpen));
      assert.equal(plan(copy, "free").price, "$0");
      assert.equal(plan(copy, "business").price, "$5,000");
      assert.match(copy.description, /\$9 a month or \$81 a year/);
      assert.match(copy.description, /Enterprise \(\$50 a month\) and Big Business \(\$5,000 once\)/);
    }
  });

  it("states the settled allowances, built from one constant each", () => {
    assert.deepEqual(EXPLANATIONS_PER_MONTH, { free: 50, pro: 200, enterprise: 1000 });
    assert.equal(FREE_LINE, "Free: 50 explanations a month with a free account (50 in your first 30 days without one)");
    for (const paymentsOpen of STATES) {
      const copy = pricingCopy(paymentsOpen);
      assert.equal(plan(copy, "free").allowance, "Free: 50 explanations a month with a free account (50 in your first 30 days without one)");
      assert.equal(plan(copy, "pro").allowance, "200 explanations a month");
      assert.equal(plan(copy, "enterprise").allowance, "1,000 explanations a month, one account");
      assert.match(plan(copy, "business").allowance, /^Unlimited explanations/);
    }
  });

  it("keeps Free next to the welcome month: a new account's first month is Pro", () => {
    for (const paymentsOpen of STATES) assert.match(plan(pricingCopy(paymentsOpen), "free").detail, /A new account's first month is Pro\./);
  });

  it("drops Teams from the page and the FAQ", () => {
    assert.doesNotMatch(PUBLIC_COPY, /\bTeams?\b|per seat|seats? (wanted|are)/);
    assert.ok(!faqItems.some((item) => item.id === "teams"));
  });
});

describe("Enterprise and Big Business", () => {
  for (const paymentsOpen of STATES) {
    const copy = pricingCopy(paymentsOpen);
    for (const id of ["enterprise", "business"] as const) {
      const tier = plan(copy, id);

      it(`${tier.name} reads Payments open soon and only links to an application email (${label(paymentsOpen)})`, () => {
        assert.equal(tier.badge, PAYMENTS_OPEN_SOON);
        assert.equal(PAYMENTS_OPEN_SOON, "Payments open soon");
        assert.match(tier.detail, /^Payments open soon\. One account, no shared seats\./);
        assert.match(tier.href, /^mailto:hello@unvibe\.site\?subject=Unvibe%20(Enterprise|Big%20Business)%20application$/);
        assert.equal(tier.cta, "Apply by email");
        assert.equal(tier.primary, false);
      });

      it(`${tier.name} has no Buy, checkout or upgrade path (${label(paymentsOpen)})`, () => {
        assert.doesNotMatch(tier.href, /checkout|stripe|billing|\/plan|\/beta|\/pricing/i);
        assert.doesNotMatch(planText(tier).join("\n"), /\bbuy\b|checkout|subscribe|upgrade|purchase now|get started|available now/i);
      });
    }
  }

  it("are the same card whatever the payments status", () => {
    const pick = (paymentsOpen: boolean) => pricingCopy(paymentsOpen).plans.filter((item) => item.id === "enterprise" || item.id === "business");
    assert.deepEqual(pick(true), pick(false));
  });

  it("Big Business is one payment and Enterprise is monthly only", () => {
    const copy = pricingCopy(false);
    assert.ok(plan(copy, "business").features.includes("One payment, not a subscription"));
    assert.ok(plan(copy, "enterprise").features.includes("Monthly only, no annual plan"));
    assert.match(TERMS_NEW_TIERS, /^Enterprise \(\$50 a month\) and Big Business \(\$5,000 once\) payments are not open yet\./);
    assert.match(TERMS_NEW_TIERS, /Big Business is a one-time payment for one account that does not renew\./);
  });

  it("never mentions a call anywhere in tier, fair-use, terms or FAQ copy", () => {
    for (const paymentsOpen of STATES) {
      for (const item of pricingCopy(paymentsOpen).plans) {
        assert.equal(item.note, null, item.id);
        for (const text of planText(item)) assert.doesNotMatch(text, /\bcall\b/i, `${item.id}: ${text}`);
      }
    }
    for (const text of [FAIR_USE.limit, FAIR_USE.enforcement, TERMS_NEW_TIERS, ...faqItems.map((item) => item.answer)]) assert.doesNotMatch(text, /\bcall with\b/i, text);
  });

  it("promises no early access and no contact that nothing sends", () => {
    assert.ok(plan(pricingCopy(false), "business").features.includes("The latest features"));
    for (const paymentsOpen of STATES) assert.doesNotMatch(PUBLIC_COPY + pricingCopy(paymentsOpen).description, /latest features first|newest features|contact you/i);
    for (const text of [FAIR_USE.limit, TERMS_NEW_TIERS, ...faqItems.map((item) => item.answer)]) assert.doesNotMatch(text, /latest features first|contact you/i, text);
  });
});

describe("fair use", () => {
  it("is one constant, and the written section is built from it", () => {
    assert.deepEqual(BUSINESS_FAIR_USE, { explanations: 5000, questions: 10000 });
    assert.equal(FAIR_USE.limit, "Big Business includes up to 5,000 explanations and 10,000 questions a month, for one person's normal use. Past that, explanations pause until the next month.");
    assert.equal(FAIR_USE.enforcement, "The app enforces this limit exactly like any other plan limit. No hidden throttling.");
    assert.equal(FAIR_USE_HREF, "/pricing#fair-use");
  });

  it("is a section with id fair-use on /pricing and a linked paragraph in the Terms", () => {
    const pricingPage = source("app", "pricing", "page.tsx");
    assert.match(pricingPage, /<section id="fair-use"/);
    assert.match(pricingPage, /\{FAIR_USE\.limit\}/);
    assert.match(pricingPage, /\{FAIR_USE\.enforcement\}/);
    const terms = source("app", "terms", "page.tsx");
    assert.match(terms, /\{FAIR_USE\.limit\} \{FAIR_USE\.enforcement\}/);
    assert.match(terms, /href=\{FAIR_USE_HREF\}/);
    assert.match(terms, /\{TERMS_NEW_TIERS\}/);
  });

  it("links every unlimited in the pricing copy to the fair-use section", () => {
    for (const paymentsOpen of STATES) {
      const copy = pricingCopy(paymentsOpen);
      const unlinked = [copy.heading.lead, copy.heading.emphasis, copy.heading.tail, copy.description, copy.disclosure, copy.termsNote ?? "", ...copy.plans.flatMap((item) => planText(item).filter((text) => text !== item.allowance))];
      for (const text of unlinked) assert.doesNotMatch(text, /unlimited/i, text);
      for (const item of copy.plans) if (/unlimited/i.test(item.allowance)) assert.equal(item.allowanceHref, FAIR_USE_HREF, item.id);
      assert.equal(plan(copy, "business").allowanceHref, FAIR_USE_HREF);
    }
    for (const text of [FAIR_USE.limit, FAIR_USE.enforcement, TERMS_NEW_TIERS, ...faqItems.flatMap((item) => [item.question, item.answer])]) assert.doesNotMatch(text, /unlimited/i, text);
  });

  it("has no other reader-visible unlimited anywhere in the site source", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|md|mdx|json)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
          readFileSync(full, "utf8").split("\n").forEach((line, index) => {
            const code = line.trim();
            if (/unlimited/i.test(code) && !/^(\*|\/\/|\/\*)/.test(code)) hits.push(`${full.slice(srcRoot.length)}:${index + 1}`);
          });
        }
      }
    };
    walk(srcRoot);
    assert.equal(hits.length, 1, hits.join(", "));
    assert.match(hits[0], /^lib\/pricingCopy\.ts:/);
  });
});

describe("copy rules for pricing, FAQ and Terms", () => {
  it("says explanations, never calls or requests, and names no person", () => {
    assert.doesNotMatch(PUBLIC_COPY, /\bcalls\b|\brequests\b/i);
    assert.doesNotMatch(PUBLIC_COPY, /founder|\bCEO\b|preston|I built/i);
    assert.doesNotMatch(PUBLIC_COPY, /\d+\s*\/\s*month/i);
    assert.doesNotMatch(PUBLIC_COPY, /50\/month/);
  });

  it("uses the exact Free line wherever Free is described, next to the welcome month", () => {
    assert.equal(FREE_USE_NOTE, `${FREE_LINE}. A new account's first month is Pro.`);
    assert.ok(betaWindowsInstallScript().startsWith(`# Unvibe private beta installer for Windows. ${FREE_LINE}. Unsigned.\n`));
    const kit = kitMarkdown();
    assert.ok(kit.includes(`${FREE_LINE}. Every new app account starts with a free month of Pro.`));
    assert.match(kit, /Pro: \$9\/month or \$81\/year, 200 explanations a month\. Enterprise: \$50 a month, 1,000 explanations a month, one account\. Big Business: \$5,000 as one payment, one account, the latest features, under a written fair-use limit/);
    assert.match(kit, /Pro, Enterprise and Big Business payments open soon; nobody can buy them yet\./);
    assert.doesNotMatch(kit, /\bTeams\b|per seat|\bcalls\b|\brequests\b|unlimited/i);
    assert.match(source("app", "beta", "page.tsx"), /\{FREE_LINE\}\. Skip sign-in/);
    assert.match(source("app", "layout.tsx"), /description: `\$\{FREE_LINE\}\. No API key or credit card required\.`/);
  });

  it("uses no long dashes in the pricing copy", () => {
    for (const paymentsOpen of STATES) assert.doesNotMatch(allText(pricingCopy(paymentsOpen)), /[—–]/);
    assert.doesNotMatch([FAIR_USE.limit, FAIR_USE.enforcement, TERMS_NEW_TIERS].join("\n"), /[—–]/);
  });

  it("FAQ states the lineup with the settled numbers", () => {
    const answer = (id: string) => faqItems.find((item) => item.id === id)?.answer ?? "";
    assert.match(answer("free"), /^Yes\. Free: 50 explanations a month with a free account \(50 in your first 30 days without one\)\./);
    assert.match(answer("free"), /A new account's first month is Pro\./);
    assert.match(answer("plans"), /Pro: \$9 a month or \$81 a year, 200 explanations a month\./);
    assert.match(answer("plans"), /Enterprise: \$50 a month, 1,000 explanations a month, one account\./);
    assert.match(answer("plans"), /Big Business: \$5,000 as one payment, one account, the latest features, and a written fair-use limit of 5,000 explanations and 10,000 questions a month/);
    assert.match(answer("plans"), /Payments for Pro, Enterprise and Big Business open soon\./);
  });
});

describe("pricing copy while payments are closed", () => {
  const closed = pricingCopy(false);
  const text = allText(closed);

  it("promises no upgrade, checkout or renewal", () => {
    assert.doesNotMatch(text, /upgrade|renew|plan page|checkout|\bbuy\b|subscribe|cancel|lifetime/i);
  });

  it("says every paid plan has payments opening soon and Free works today", () => {
    assert.equal(closed.heading.lead + closed.heading.emphasis + closed.heading.tail, "Start free today. Paid plans open soon.");
    for (const id of ["pro", "enterprise", "business"] as const) {
      assert.equal(plan(closed, id).badge, PAYMENTS_OPEN_SOON, id);
      assert.match(plan(closed, id).detail, /^Payments open soon\. /, id);
      assert.equal(plan(closed, id).cta, "Apply by email", id);
      assert.match(plan(closed, id).href, /^mailto:hello@unvibe\.site\?subject=Unvibe%20/, id);
    }
    assert.equal(plan(closed, "pro").detail, "Payments open soon. One developer account. Your Free plan keeps working until then.");
    assert.match(closed.disclosure, /^Prices in USD\. Pro, Enterprise and Big Business are not on sale yet, so nothing is billed today\./);
    assert.equal(closed.termsNote, "Pro is not on sale yet. Until it opens, nothing is billed and your Free plan keeps working.");
    assert.doesNotMatch(text, /available (now|today)|on sale now|get pro/i);
  });

  it("has no button that leads to a dead end", () => {
    for (const item of closed.plans) assert.ok(item.href === "/beta" || item.href.startsWith("mailto:hello@unvibe.site"), item.id);
  });
});

describe("pricing copy in both states", () => {
  for (const paymentsOpen of STATES) {
    const copy = pricingCopy(paymentsOpen);

    it(`has one filled button, Download free (${label(paymentsOpen)})`, () => {
      assert.deepEqual(copy.plans.filter((item) => item.primary).map((item) => [item.id, item.cta, item.href]), [["free", "Download free", "/beta"]]);
    });

    it(`keeps allowance numbers in the allowance line only (${label(paymentsOpen)})`, () => {
      for (const item of copy.plans) {
        for (const text of [item.detail, item.eyebrow, item.badge, ...item.features]) assert.doesNotMatch(text, /\d[\d,]*\s*(ai\s+)?(explanations|questions|projects|items|reviews)/i, `${item.id}: ${text}`);
      }
    });
  }

  it("lists Briefs and Why does this exist? as Free; Pro adds only the AI explanation of diffs and Briefs", () => {
    const plans = pricingCopy(false);
    const free = plan(plans, "free").features;
    const pro = plan(plans, "pro").features;
    assert.ok(free.includes("Briefs of your Git changes, made on your computer"));
    assert.ok(free.includes("“Why does this exist?” from your Git history"));
    assert.ok(pro.includes("AI explanations of Git diffs and change Briefs"));
    for (const feature of pro) if (/brief|diff/i.test(feature)) assert.match(feature, /^AI explanations of /, feature);
    for (const paymentsOpen of STATES) assert.match(pricingCopy(paymentsOpen).description, /adds Expert depth, AI explanations of Git diffs and nearby-file context\./);
  });
});

describe("pricing copy once payments open", () => {
  const open = pricingCopy(true);

  it("keeps today's Pro wording", () => {
    assert.equal(`${open.heading.lead}${open.heading.emphasis}${open.heading.tail}`, "Start free. Upgrade when it earns a place in your day.");
    assert.equal(open.description, `Download Unvibe free. Pro is $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year and adds Expert depth, AI explanations of Git diffs and nearby-file context. Enterprise ($50 a month) and Big Business ($5,000 once) open soon.`);
    assert.equal(open.disclosure, "Prices in USD. Pro renews until you cancel. Enterprise and Big Business are not on sale yet, so nothing is billed for them today. Big Business will be one payment, not a subscription.");
    assert.equal(open.termsNote, null);
    assert.deepEqual(open.plans.slice(0, 2).map((item) => [item.id, item.badge, item.detail, item.cta, item.href]), [
      ["free", "No card needed", "No card and no separate API key. A new account's first month is Pro.", "Download free", "/beta"],
      ["pro", "Individual", "One developer account. Upgrade, manage or cancel from the Plan page in the app.", "Download, then upgrade", "/beta"],
    ]);
  });

  it("shares features and the featured card with the closed copy", () => {
    const closed = pricingCopy(false);
    const shape = (copy: PricingCopy) => copy.plans.map((item) => [item.id, item.name, item.eyebrow, item.allowance, item.features, item.featured]);
    assert.deepEqual(shape(open), shape(closed));
  });
});
