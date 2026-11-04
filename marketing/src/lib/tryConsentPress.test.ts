import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TryIt } from "@/components/paper/TryIt";
import { TRY_CONSENT_REASONS, tryConsentReasons } from "./tryConsent";

Object.assign(globalThis, { React });

describe("Try it consent boxes (W18)", () => {
  const markup = renderToStaticMarkup(createElement(TryIt));

  it("start unticked, with Explain it enabled and no grey 'tick both boxes' line", () => {
    for (const id of ["try-consent-send", "try-consent-age"]) {
      const box = markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? "";
      assert.ok(box, id);
      assert.doesNotMatch(box, /\bchecked\b/);
    }
    const go = markup.match(/<button[^>]*class="try__go"[^>]*>/)?.[0] ?? "";
    assert.doesNotMatch(go, /aria-disabled|disabled/);
    assert.doesNotMatch(markup, /Tick both boxes to explain/);
  });

  it("have an empty alert next to each box, ready for the reason", () => {
    assert.match(markup, /<label for="try-consent-send">[^<]+<\/label><\/p><p class="try__fine try__why" id="try-consent-send-why" role="alert"><\/p>/);
    assert.match(markup, /<label for="try-consent-age">[^<]+<\/label><\/p><p class="try__fine try__why" id="try-consent-age-why" role="alert"><\/p>/);
  });

  it("give a reason only after a press, and only for the boxes still unticked", () => {
    assert.deepEqual(tryConsentReasons({ aiSend: false, age18: false }, false), { aiSend: "", age18: "" });
    assert.deepEqual(tryConsentReasons({ aiSend: false, age18: true }, true), { aiSend: TRY_CONSENT_REASONS.aiSend, age18: "" });
    assert.deepEqual(tryConsentReasons({ aiSend: true, age18: false }, true), { aiSend: "", age18: TRY_CONSENT_REASONS.age18 });
    assert.deepEqual(tryConsentReasons({ aiSend: true, age18: true }, true), { aiSend: "", age18: "" });
  });
});
