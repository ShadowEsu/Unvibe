import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isWaitlistAdminAuthorized, waitlistAdminOpenAccess } from "./adminAuth";

describe("isWaitlistAdminAuthorized", () => {
  it("fails closed without a configured token", () => {
    const previous = process.env.WAITLIST_ADMIN_TOKEN;
    try {
      delete process.env.WAITLIST_ADMIN_TOKEN;
      assert.equal(waitlistAdminOpenAccess(), false);
      assert.equal(isWaitlistAdminAuthorized(null), false);
      assert.equal(isWaitlistAdminAuthorized("Bearer anything"), false);
    } finally {
      if (previous === undefined) delete process.env.WAITLIST_ADMIN_TOKEN;
      else process.env.WAITLIST_ADMIN_TOKEN = previous;
    }
  });

  it("accepts only an exact bearer token", () => {
    const previous = process.env.WAITLIST_ADMIN_TOKEN;
    process.env.WAITLIST_ADMIN_TOKEN = "test-admin-token";
    try {
      assert.equal(isWaitlistAdminAuthorized(null), false);
      assert.equal(isWaitlistAdminAuthorized("Basic test-admin-token"), false);
      assert.equal(isWaitlistAdminAuthorized("Bearer wrong-token"), false);
      assert.equal(isWaitlistAdminAuthorized("Bearer test-admin-token"), true);
    } finally {
      if (previous === undefined) delete process.env.WAITLIST_ADMIN_TOKEN;
      else process.env.WAITLIST_ADMIN_TOKEN = previous;
    }
  });
});
