import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_EVENT_SET, ANALYTICS_EVENTS } from "./analyticsEvents";

describe("analytics events", () => {
  it("is a closed named list", () => {
    assert.equal(ANALYTICS_EVENTS.includes("page_viewed"), true);
    assert.equal(ANALYTICS_EVENT_SET.has("waitlist_completed"), true);
    assert.equal(ANALYTICS_EVENT_SET.has("beta_install_copied"), true);
    assert.equal(ANALYTICS_EVENT_SET.has("survey_opened"), true);
    assert.equal(ANALYTICS_EVENT_SET.has("email_captured"), false);
  });
});
