import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isWaitlistAdminAuthorized } from "./adminAuth";

describe("isWaitlistAdminAuthorized", () => {
  it("accepts only the exact bearer token", () => {
    const previous = process.env.WAITLIST_ADMIN_TOKEN;
    process.env.WAITLIST_ADMIN_TOKEN = "test-admin-token";
    try {
      assert.equal(isWaitlistAdminAuthorized("Bearer test-admin-token"), true);
      assert.equal(isWaitlistAdminAuthorized("Bearer wrong-token"), false);
      assert.equal(isWaitlistAdminAuthorized(null), false);
    } finally {
      if (previous === undefined) delete process.env.WAITLIST_ADMIN_TOKEN;
      else process.env.WAITLIST_ADMIN_TOKEN = previous;
    }
  });
});
