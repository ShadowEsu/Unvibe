import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderHome } from "./testRenderHome";
import PrivacyPage from "@/app/privacy/page";
import { KEPT, SENT } from "@/components/paper/WhatLeaves";
import { faqItems } from "@/data/faq";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

const text = (html: string) =>
  html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const privacy = text(renderToStaticMarkup(createElement(PrivacyPage)));
const sentFaq = faqItems.find((item) => item.id === "sent")?.answer ?? "";

/** Each list item, and the policy or FAQ sentences that back it. Security reviews this list (Design W4, S13). */
const BACKING: Readonly<Record<string, readonly string[]>> = {
  [SENT[0]]: ["the selected code and its language", "a file you select or open is sent once it passes the scan"],
  [SENT[1]]: ["path inside your project", "The full path on your computer is not sent."],
  [SENT[2]]: ["the name of the project folder you last worked in"],
  [SENT[3]]: ["Any question you type is sent too."],
  [SENT[4]]: ["up to two files from your project that the snippet imports", "the first 4,000 characters of each"],
  [SENT[5]]: ["Git diffs are sent only when you ask a Brief to explain them."],
  [SENT[6]]: ["the app sends a random install ID with each cloud explanation", "your computer's system (Mac or Windows) and the app version", "explanations carry your sign-in token instead of the install ID"],
  [KEPT[0]]: ["Your repo is never uploaded."],
  [KEPT[1]]: ["scanned on your computer before they are sent", "A known credential blocks the request"],
  [KEPT[2]]: ["Your code, the explanation text and any notes you add stay on your computer.", "syncs a record of each explanation"],
  [KEPT[3]]: ["It does not perform screen recording, OCR capture, or keylogging."],
};

describe("What leaves your computer (W4)", () => {
  it("every list item is backed by the privacy page or the FAQ's What gets sent answer", () => {
    assert.deepEqual(Object.keys(BACKING).sort(), [...SENT, ...KEPT].sort(), "a list item has no backing entry");
    for (const [item, facts] of Object.entries(BACKING)) {
      for (const fact of facts) assert.ok(privacy.includes(fact) || sentFaq.includes(fact), `"${item}": "${fact}" is not on /privacy or in the FAQ`);
    }
  });

  it("the home page's privacy section shows the kept items, Security's key-check line and the link to the full list", async () => {
    const html = await renderHome();
    const start = html.indexOf('<section class="d-privacy"');
    assert.ok(start > 0, "no privacy section on home");
    const markup = html.slice(start, html.indexOf("</section>", start));
    const section = text(markup);
    for (const item of [KEPT[0], KEPT[1], KEPT[3]]) assert.ok(section.includes(item), item);
    assert.match(section, /Unvibe checks for keys and tokens on your computer first, and a known key stops the request\./);
    assert.doesNotMatch(text(html), /keys stay on your computer/i);
    assert.match(markup, /<a [^>]*href="\/privacy"[^>]*>What leaves your computer/);
  });
});
