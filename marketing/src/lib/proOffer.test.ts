import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InviteFriend } from "@/components/paper/InviteFriend";
import { proSentence } from "./proOffer";
import { AI_MAINTENANCE_NOTE } from "./aiMaintenance";

Object.assign(globalThis, { React });

/** Visible text: tags dropped, the apostrophe React escapes put back. */
const text = (element: React.ReactElement) =>
  renderToStaticMarkup(element).replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

/** Other ways the site used to say whether Pro exists. */
const OLD = /starts (a new account )?with a free month of Pro|Pro opens soon/i;

const marketingRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The AI switch is read once when lib/aiMaintenance loads (Next inlines it at build time), so each flag
 * state renders the Pro surfaces in its own process, as the build would: /beta, /pricing, the FAQ, the kit.
 */
function surfacesWithFlag(flag: "1" | ""): Record<"beta" | "pricing" | "faq" | "kit", string> {
  const script = [
    'const React = require("react");',
    'const { renderToStaticMarkup } = require("react-dom/server");',
    "Object.assign(globalThis, { React });",
    'const text = (el) => renderToStaticMarkup(el).replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "\'").replace(/\\s+/g, " ");',
    'const { Download } = require("@/site/Download");',
    'const { PricingCards } = require("@/site/PricingCards");',
    'const { pricingCopy } = require("@/lib/pricingCopy");',
    'const { faqItems } = require("@/data/faq");',
    'const { kitMarkdown } = require("@/lib/kit");',
    "process.stdout.write(JSON.stringify({",
    "  beta: text(React.createElement(Download)),",
    "  pricing: text(React.createElement(PricingCards, { copy: pricingCopy(false), paymentsOpen: false })),",
    '  faq: faqItems.find((item) => item.id === "pro-annual").answer,',
    "  kit: kitMarkdown(),",
    "}));",
  ].join("\n");
  const run = spawnSync(path.join(marketingRoot, "node_modules/.bin/tsx"), ["-e", script], {
    cwd: marketingRoot,
    env: { ...process.env, NEXT_PUBLIC_AI_MAINTENANCE: flag },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

const live = surfacesWithFlag("");
const paused = surfacesWithFlag("1");

describe("the Pro sentence", () => {
  it("drops the try-now half while AI features are paused", () => {
    assert.equal(proSentence(true), "Pro isn't on sale yet.");
    assert.match(proSentence(false), /^Pro isn't on sale yet\. You can try it now: /);
  });

  it("is the one Pro line in the FAQ and the kit, in full with AI on; /beta and /pricing make no Pro offer", () => {
    for (const name of ["faq", "kit"] as const) {
      assert.ok(live[name].includes(proSentence(false)), `${name} lacks the Pro sentence`);
      assert.doesNotMatch(live[name], OLD, name);
      assert.doesNotMatch(live[name], /Try Pro today/, name);
    }
    // Council R07 / Design round 06: next to "Not on sale yet" a try-it-today line reads as an offer.
    for (const name of ["beta", "pricing"] as const) {
      assert.doesNotMatch(live[name], OLD, name);
      assert.doesNotMatch(live[name], /Try Pro today|You can try it now|gift code/, name);
    }
  });

  it("says only 'Pro isn't on sale yet.' in the FAQ and the kit while paused, and /pricing has no Try Pro line", () => {
    for (const name of ["faq", "kit"] as const) {
      assert.ok(paused[name].includes(proSentence(true)), name);
      assert.doesNotMatch(paused[name], /You can try it now/, name);
    }
    assert.doesNotMatch(paused.pricing, /Try Pro today|gift code/);
    assert.match(paused.pricing, /Not on sale yet/);
  });

  it("while paused, /pricing (under the plans) and /beta (under Get Unvibe) say AI features are paused; not with AI on", () => {
    for (const name of ["pricing", "beta"] as const) {
      assert.equal(paused[name].split(AI_MAINTENANCE_NOTE).length - 1, 1, `${name} paused`);
      assert.ok(!live[name].includes(AI_MAINTENANCE_NOTE), `${name} live`);
    }
    assert.ok(paused.pricing.indexOf(AI_MAINTENANCE_NOTE) > paused.pricing.indexOf("Email about Teams"), "under the plans");
    assert.ok(paused.beta.indexOf(AI_MAINTENANCE_NOTE) > paused.beta.indexOf("Get Unvibe."), "under Get Unvibe");
  });

  it("the home invite says Pro isn't on sale, the free month, and that a link alone adds nothing", () => {
    const invite = text(createElement(InviteFriend));
    assert.match(invite, /Pro isn't on sale yet\. New accounts get a free month of Pro, and each friend you invite adds one\./);
    assert.match(invite, /A link alone adds no Pro months\./);
    assert.doesNotMatch(invite, OLD);
    assert.equal(invite.match(/on sale/g)?.length, 1, "said once");
  });
});
