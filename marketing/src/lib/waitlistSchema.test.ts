import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { waitlistSchema } from "./waitlistSchema";

describe("waitlistSchema", () => {
  it("accepts a complete valid payload", () => {
    const parsed = waitlistSchema.safeParse({
      firstName: "Preston",
      lastName: "Susanto",
      email: " Student@Example.com ",
      referredBy: "abc12345",
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.email, "Student@Example.com");
      assert.equal(parsed.data.firstName, "Preston");
      assert.equal(parsed.data.lastName, "Susanto");
    }
  });

  it("rejects invalid email", () => {
    const parsed = waitlistSchema.safeParse({
      email: "not-an-email",
    });
    assert.equal(parsed.success, false);
  });

  it("requires a last name", () => {
    const parsed = waitlistSchema.safeParse({
      email: "a@b.com",
      firstName: "Preston",
    });
    assert.equal(parsed.success, false);
  });

  it("keeps names short", () => {
    const parsed = waitlistSchema.safeParse({
      email: "a@b.com",
      firstName: "n".repeat(81),
      lastName: "Susanto",
    });
    assert.equal(parsed.success, false);
  });
});
