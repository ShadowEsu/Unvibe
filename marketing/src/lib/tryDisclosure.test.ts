import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/privacy/page";
import { kitMarkdown } from "./kit";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

// Try it sends the pasted code to Unvibe's server and Anthropic. Nothing about it runs in the browser.
describe("Try it disclosure", () => {
  it("the kit says the pasted code goes to Unvibe and Anthropic, not that it runs in the browser", () => {
    const kit = kitMarkdown();
    assert.match(kit, /try it online on the homepage \(the pasted code goes to Unvibe and Anthropic's Claude API\)/);
    assert.doesNotMatch(kit, /in the browser/i);
  });

  it("the privacy page says the server refuses key formats and names the promo record", () => {
    const page = renderToStaticMarkup(createElement(PrivacyPage)).replace(/\s+/g, " ");
    assert.doesNotMatch(page, /generates explanations from the filtered snippet/);
    assert.match(page, /sent to Unvibe&#x27;s server, which refuses common key formats, and then to Anthropic to write/);
    assert.match(page, /Anthropic&#x27;s Claude API/);
    assert.match(page, /href="https:\/\/www.anthropic.com\/legal\/commercial-terms"/);
    assert.match(page, /Unvibe is for people 18 or older, as our <a href="\/terms">Terms<\/a> say\./);
    assert.match(page, /nothing is filtered in your browser/);
    assert.match(page, /redemption record: a fingerprint of the code \(not the code itself\), your account and its email/);
    assert.match(page, /the link to your account and the email are removed/);
  });
});
