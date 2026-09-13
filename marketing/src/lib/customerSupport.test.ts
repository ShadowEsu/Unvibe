import assert from "node:assert/strict";
import test from "node:test";
import { prepareCustomerSupportResponse } from "./customerSupport";

test("routine waitlist questions receive a factual friendly reply", () => {
  const response = prepareCustomerSupportResponse({ subject: "Private beta", text: "How can I get early access?" });
  assert.equal(response.decision, "auto_reply");
  assert.equal(response.category, "waitlist");
  assert.match(response.text, /^Hi!/);
  assert.match(response.text, /\nWebsite: https:\/\/unvibe\.site\n/);
});

test("billing, account, privacy, and bug reports are always held for founder review", () => {
  for (const text of ["I need a refund", "Google login is broken", "Please delete my data", "The app crashed"]) {
    const response = prepareCustomerSupportResponse({ text });
    assert.equal(response.decision, "draft", text);
  }
});

test("stop requests are suppressed without a reply", () => {
  const response = prepareCustomerSupportResponse({ text: "Please remove me from all messages" });
  assert.equal(response.decision, "suppress");
});

