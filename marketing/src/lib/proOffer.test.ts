import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BetaDownloadsPage from "@/app/beta/page";
import { InviteFriend } from "@/components/paper/InviteFriend";
import { faqItems } from "@/data/faq";
import { kitMarkdown } from "./kit";
import { PRO_SENTENCE } from "./proOffer";

Object.assign(globalThis, { React });

/** Visible text: tags dropped, the apostrophe React escapes put back. */
const text = (element: React.ReactElement) =>
  renderToStaticMarkup(element).replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

/** Other ways the site used to say whether Pro exists. */
const OLD = /starts (a new account )?with a free month of Pro|Pro opens soon/i;

describe("the Pro sentence", () => {
  it("is Design's wording", () => {
    assert.equal(PRO_SENTENCE, "Pro isn't on sale yet. You can try it now: new accounts get a free month, and each friend you invite adds one.");
  });

  it("is the one Pro line on /beta, the home invite section, the FAQ and the kit", () => {
    const surfaces: Record<string, string> = {
      beta: text(createElement(BetaDownloadsPage)),
      invite: text(createElement(InviteFriend)),
      faq: faqItems.find((item) => item.id === "pro-annual")?.answer ?? "",
      kit: kitMarkdown(),
    };
    for (const [name, copy] of Object.entries(surfaces)) {
      assert.ok(copy.includes(PRO_SENTENCE), `${name} lacks the Pro sentence`);
      assert.doesNotMatch(copy, OLD, name);
      assert.doesNotMatch(copy, /Try Pro today/, name);
    }
  });
});
