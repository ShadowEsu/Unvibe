import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RedeemPage from "@/app/redeem/page";

Object.assign(globalThis, { React });
// Sign-in configured, so the buttons render for real (no network: nothing is called while rendering).
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake-project.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

describe("/redeem asks for /activate's agreement", () => {
  const markup = renderToStaticMarkup(createElement(RedeemPage));

  it("shows two separate unticked boxes with /activate's words", () => {
    assert.match(markup, /<input id="redeem-agree-terms" type="checkbox"\/>/);
    assert.match(markup, /<input id="redeem-agree-age" type="checkbox"\/>/);
    assert.doesNotMatch(markup, /\bchecked(?:=|\s|\/?>)/);
    const text = markup.replace(/<[^>]+>/g, "");
    assert.ok(text.includes("I agree to the Terms and the Privacy Policy"), "the Terms and Privacy box");
    assert.ok(text.includes("I&#x27;m 18 or older") || text.includes("I'm 18 or older"), "the 18 or older box");
    assert.match(markup, /<a href="\/terms"[^>]*>Terms<\/a>/);
    assert.match(markup, /<a href="\/privacy"[^>]*>Privacy Policy<\/a>/);
  });

  it("puts the boxes before the Google and email buttons", () => {
    const boxes = markup.indexOf("redeem-agree-terms");
    assert.ok(boxes >= 0);
    assert.ok(boxes < markup.indexOf("Continue with Google"));
    assert.ok(boxes < markup.indexOf("Email me a secure sign-in link"));
  });

  it("marks Google, the email link and Redeem as not ready until both are ticked", () => {
    for (const label of ["Continue with Google", "Email me a secure sign-in link", "Redeem code"]) {
      const button = new RegExp(`<button[^>]*aria-disabled="true"[^>]*>${label}</button>`);
      assert.match(markup, button, label);
    }
  });

  it("writes no em or en dashes", () => {
    assert.doesNotMatch(markup.replace(/<[^>]+>/g, ""), /[\u2013\u2014]/);
  });
});
