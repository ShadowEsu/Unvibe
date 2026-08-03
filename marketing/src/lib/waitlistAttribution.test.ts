import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeWaitlistAttribution } from "./waitlistAttribution";

describe("summarizeWaitlistAttribution", () => {
  it("groups signups by UTM and counts attributed referrals without personal data", () => {
    const rows = summarizeWaitlistAttribution([
      { firstName: "A", lastName: "B", email: "a@example.com", referralCode: "one", createdAt: "2026-08-01T00:00:00.000Z", utmSource: "youtube", utmMedium: "video", utmCampaign: "launch_week" },
      { firstName: "C", lastName: "D", email: "c@example.com", referralCode: "two", createdAt: "2026-08-01T00:00:00.000Z", utmSource: "youtube", utmMedium: "video", utmCampaign: "launch_week", referredBy: "one" },
      { firstName: "E", lastName: "F", email: "e@example.com", referralCode: "three", createdAt: "2026-08-01T00:00:00.000Z" },
    ]);
    assert.deepEqual(rows, [
      { label: "youtube · video · launch_week", signups: 2, referrals: 1 },
      { label: "Direct / unknown · organic", signups: 1, referrals: 0 },
    ]);
  });
});
