import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INSTALL_SOURCES, installSourceFor, parseInstallSource } from "./installSource";

describe("installSourceFor", () => {
  it("maps known utm_source values, case and spaces aside", () => {
    assert.equal(installSourceFor("?utm_source=reddit&utm_medium=social&utm_campaign=launch", false), "reddit");
    assert.equal(installSourceFor("?utm_source=HackerNews", false), "hacker_news");
    assert.equal(installSourceFor("?utm_source=%20twitter%20", false), "x");
    assert.equal(installSourceFor("?utm_source=google", false), "search");
    assert.equal(installSourceFor("?utm_source=producthunt", false), "product_hunt");
    assert.equal(installSourceFor("?utm_source=app", false), "app");
    assert.equal(installSourceFor("?utm_source=newsletter", false), "email");
  });

  it("falls back to utm_medium, then other, for an unlisted utm_source", () => {
    assert.equal(installSourceFor("?utm_source=acme-weekly&utm_medium=email", false), "email");
    assert.equal(installSourceFor("?utm_source=somesite&utm_medium=directory", false), "directory");
    assert.equal(installSourceFor("?utm_source=calhacks", false), "other");
  });

  it("a friend's code is referral; a listed ref value maps; anything else is other; no tag is direct", () => {
    assert.equal(installSourceFor("?ref=abcd1234", true), "referral");
    assert.equal(installSourceFor("", true), "referral", "a code remembered from an earlier page");
    assert.equal(installSourceFor("?ref=badge", false), "directory");
    assert.equal(installSourceFor("?ref=producthunt", false), "product_hunt");
    assert.equal(installSourceFor("?ref=someone", false), "other");
    assert.equal(installSourceFor("", false), "direct");
    assert.equal(installSourceFor("?utm_campaign=only-a-campaign", false), "direct");
  });

  it("utm_source wins over a friend's code, as the waitlist keeps both", () => {
    assert.equal(installSourceFor("?utm_source=reddit&ref=abcd1234", true), "reddit");
  });

  it("never returns any part of the input: personal or odd values become other", () => {
    for (const value of ["jane.doe@example.com", "Jane Doe", "constructor", "__proto__", "toString", "x".repeat(500), "reddit<script>", "%00"]) {
      const label = installSourceFor(`?utm_source=${encodeURIComponent(value)}`, false);
      assert.equal(label, "other", value);
      const fromRef = installSourceFor(`?ref=${encodeURIComponent(value)}`, false);
      assert.equal(fromRef, "other", value);
    }
  });

  it("every label is on the list and short", () => {
    for (const label of INSTALL_SOURCES) {
      assert.match(label, /^[a-z_]{1,12}$/);
      assert.equal(parseInstallSource(label), label);
    }
  });
});

describe("parseInstallSource", () => {
  it("accepts only listed labels", () => {
    assert.equal(parseInstallSource("reddit"), "reddit");
    for (const value of ["Reddit", "reddit ", "", null, undefined, 3, {}, ["reddit"], "utm_source=reddit", "constructor"]) {
      assert.equal(parseInstallSource(value), null, String(value));
    }
  });
});
