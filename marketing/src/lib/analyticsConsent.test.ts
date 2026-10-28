import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANALYTICS_POLICY_VERSION, analyticsConsentRecord, readAnalyticsConsent } from "./analyticsConsent";

const AT = new Date("2026-10-28T09:00:00Z");

describe("readAnalyticsConsent", () => {
  it("asks when nothing is stored", () => {
    assert.equal(readAnalyticsConsent(null, false), "ask");
    assert.equal(readAnalyticsConsent("", false), "ask");
  });

  it("asks again after an answer to another policy version", () => {
    assert.equal(readAnalyticsConsent(JSON.stringify({ v: "2026-01-01", choice: "allow", at: AT.toISOString() }), false), "ask");
    assert.equal(readAnalyticsConsent(JSON.stringify({ choice: "allow" }), false), "ask");
  });

  it("asks for an unreadable record or an unknown choice", () => {
    assert.equal(readAnalyticsConsent("allow", false), "ask");
    assert.equal(readAnalyticsConsent("null", false), "ask");
    assert.equal(readAnalyticsConsent(JSON.stringify({ v: ANALYTICS_POLICY_VERSION, choice: "yes" }), false), "ask");
  });

  it("reads No thanks", () => {
    assert.equal(readAnalyticsConsent(analyticsConsentRecord("deny", AT), false), "deny");
  });

  it("reads Allow", () => {
    assert.equal(readAnalyticsConsent(analyticsConsentRecord("allow", AT), false), "allow");
  });

  it("Global Privacy Control is No thanks, whatever is stored", () => {
    assert.equal(readAnalyticsConsent(null, true), "deny");
    assert.equal(readAnalyticsConsent(analyticsConsentRecord("allow", AT), true), "deny");
  });

  it("stores the policy version, the choice and the time", () => {
    assert.deepEqual(JSON.parse(analyticsConsentRecord("allow", AT)), { v: "2026-10-28", choice: "allow", at: "2026-10-28T09:00:00.000Z" });
  });
});
