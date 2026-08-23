import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicWaitlistFailure } from "./waitlistErrors";

describe("publicWaitlistFailure", () => {
  it("does not expose a missing storage secret", () => {
    assert.deepEqual(publicWaitlistFailure(new Error("Durable waitlist storage is not configured")), {
      code: "waitlist_storage_setup_required",
      error: "The private beta list is being configured. Please try again shortly.",
      status: 503,
    });
  });

  it("returns a retryable state when Supabase is unavailable", () => {
    assert.deepEqual(publicWaitlistFailure(new Error("Supabase waitlist insert failed: request timeout")), {
      code: "waitlist_storage_unavailable",
      error: "The private beta list is temporarily unavailable. Please try again shortly.",
      status: 503,
    });
  });
});
