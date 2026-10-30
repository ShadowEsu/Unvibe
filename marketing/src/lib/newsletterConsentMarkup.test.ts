import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NewsletterSignup } from "@/components/paper/NewsletterSignup";

Object.assign(globalThis, { React });

describe("newsletter signup consent", () => {
  it("renders an unticked checkbox with its own label in every placement", () => {
    for (const id of ["footer", "home", "about"]) {
      const markup = renderToStaticMarkup(createElement(NewsletterSignup, { id }));
      assert.match(markup, new RegExp(`<input type="checkbox" id="newsletter-${id}-consent"`));
      assert.match(markup, new RegExp(`<label for="newsletter-${id}-consent">[^<]+</label>`));
      assert.doesNotMatch(markup, /\bchecked(?:=|\s|\/?>)/);
    }
  });
});
