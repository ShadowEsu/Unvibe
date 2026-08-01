import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { waitlistDetailsSchema, waitlistSchema } from "./waitlistSchema";

describe("waitlistSchema", () => {
  it("accepts a complete valid payload", () => {
    const parsed = waitlistSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: " Student@Example.com ",
      referredBy: "abc12345",
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.email, "Student@Example.com");
      assert.equal(parsed.data.firstName, "Ada");
    }
  });

  it("rejects invalid email", () => {
    const parsed = waitlistSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "not-an-email",
    });
    assert.equal(parsed.success, false);
  });

  it("requires first and last name", () => {
    const parsed = waitlistSchema.safeParse({
      email: "a@b.com",
    });
    assert.equal(parsed.success, false);
  });

  it("accepts optional details after signup", () => {
    const parsed = waitlistDetailsSchema.safeParse({
      email: "ada@example.com",
      tool: "cursor",
      experience: "student",
      message: "I want to understand React hooks",
    });
    assert.equal(parsed.success, true);
  });
});
