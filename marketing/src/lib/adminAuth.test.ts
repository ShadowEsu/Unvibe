import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isWaitlistAdminAuthorized, waitlistAdminOpenAccess } from "./adminAuth";

describe("isWaitlistAdminAuthorized", () => {
  it("always allows the private founder URL", () => {
    const previous = process.env.WAITLIST_ADMIN_TOKEN;
    process.env.WAITLIST_ADMIN_TOKEN = "test-admin-token";
    try {
      assert.equal(waitlistAdminOpenAccess(), true);
      assert.equal(isWaitlistAdminAuthorized(null), true);
      assert.equal(isWaitlistAdminAuthorized("Bearer anything"), true);
    } finally {
      if (previous === undefined) delete process.env.WAITLIST_ADMIN_TOKEN;
      else process.env.WAITLIST_ADMIN_TOKEN = previous;
    }
  });
});
