import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/privacy/page";
import { kitMarkdown } from "./kit";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

// Try it sends the pasted code to Unvibe's server and Google Gemini. Nothing about it runs in the browser.
describe("Try it disclosure", () => {
  it("the kit says the pasted code goes to Unvibe and Google Gemini, not that it runs in the browser", () => {
    const kit = kitMarkdown();
    assert.match(kit, /try it online on the homepage \(the pasted code goes to Unvibe and Google Gemini\)/);
    assert.doesNotMatch(kit, /in the browser/i);
  });

  it("the privacy page says the server refuses key formats and names the promo record", () => {
    const page = renderToStaticMarkup(createElement(PrivacyPage)).replace(/\s+/g, " ");
    assert.doesNotMatch(page, /generates explanations from the filtered snippet/);
    assert.match(page, /sent to Unvibe&#x27;s server, which refuses common key formats, and then to Google Gemini/);
    assert.match(page, /nothing is filtered in your browser/);
    assert.match(page, /redemption record: a fingerprint of the code \(not the code itself\), your account and its email/);
    assert.match(page, /the link to your account and the email are removed/);
  });
});
