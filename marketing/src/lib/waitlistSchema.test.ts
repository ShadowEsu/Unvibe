import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { waitlistSchema } from "./waitlistSchema";

describe("waitlistSchema", () => {
  it("accepts a complete valid payload", () => {
    const parsed = waitlistSchema.safeParse({
      email: " Student@Example.com ",
      tool: "cursor",
      experience: "student",
      message: "Help me understand React hooks",
      referredBy: "abc12345",
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.email, "Student@Example.com");
      assert.equal(parsed.data.tool, "cursor");
    }
  });

  it("rejects invalid email", () => {
    const parsed = waitlistSchema.safeParse({
      email: "not-an-email",
      tool: "cursor",
      experience: "student",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects unknown tool", () => {
    const parsed = waitlistSchema.safeParse({
      email: "a@b.com",
      tool: "notepad",
      experience: "student",
    });
    assert.equal(parsed.success, false);
  });
});
