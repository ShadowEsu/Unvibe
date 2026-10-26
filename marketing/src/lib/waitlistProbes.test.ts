import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isProbeWaitlistEmail } from "./waitlistProbes";

describe("isProbeWaitlistEmail", () => {
  it("keeps ordinary waitlist signups", () => {
    assert.equal(isProbeWaitlistEmail("alex.chen@mail.test", "Alex Chen"), false);
  });

  it("drops probes, examples, and the install sentinel", () => {
    assert.equal(isProbeWaitlistEmail("probe-fix-1@unvibe.test"), true);
    assert.equal(isProbeWaitlistEmail("node-test@example.com"), true);
    assert.equal(isProbeWaitlistEmail("beta-install-counts@unvibe.internal"), true);
  });
});
