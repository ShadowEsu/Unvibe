import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isProPromoCode, waitlistSchema } from "./waitlistSchema";

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

  it("accepts an optional promo code", () => {
    const parsed = waitlistSchema.safeParse({
      email: "a@b.com",
      tool: "cursor",
      experience: "student",
      promoCode: "UnvibeSpecial",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.promoCode, "UnvibeSpecial");
    }
  });
});

describe("isProPromoCode", () => {
  it("matches the promo code regardless of case or whitespace", () => {
    assert.equal(isProPromoCode("UnvibeSpecial"), true);
    assert.equal(isProPromoCode("unvibespecial"), true);
    assert.equal(isProPromoCode("  UNVIBESPECIAL  "), true);
  });

  it("rejects anything that is not the exact promo code", () => {
    assert.equal(isProPromoCode("Unvibe"), false);
    assert.equal(isProPromoCode(""), false);
    assert.equal(isProPromoCode(undefined), false);
    assert.equal(isProPromoCode(null), false);
    assert.equal(isProPromoCode("UnvibeSpecial2"), false);
  });
});
