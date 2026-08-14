import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeWaitlistFunnel, type WaitlistEntry } from "./waitlistStore";

function entry(overrides: Partial<WaitlistEntry>): WaitlistEntry {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    referralCode: "abc12345",
    createdAt: "2026-07-30T10:00:00.000Z",
    ...overrides,
  };
}

describe("summarizeWaitlistFunnel", () => {
  it("returns only bounded, aggregate attribution and daily signup counts", () => {
    const summary = summarizeWaitlistFunnel([
      entry({ utmSource: "github", utmMedium: "organic", utmCampaign: "readme-cta", createdAt: "2026-07-30T10:00:00.000Z" }),
      entry({ email: "grace@example.com", referralCode: "def67890", utmSource: "github", utmMedium: "organic", utmCampaign: "readme-cta", referredBy: "abc12345", createdAt: "2026-07-30T11:00:00.000Z" }),
      entry({ email: "margaret@example.com", referralCode: "9876abcd", utmSource: "not an allowed source@example.com", utmMedium: "organic", utmCampaign: "campaign@example.com", createdAt: "2026-07-29T10:00:00.000Z" }),
      entry({ email: "direct@example.com", referralCode: "1234abcd", createdAt: "2026-07-29T12:00:00.000Z" }),
    ], new Date("2026-07-30T20:00:00.000Z"));

    assert.equal(summary.total, 4);
    assert.equal(summary.attributed, 3);
    assert.equal(summary.referred, 1);
    assert.deepEqual(summary.sourceCounts, [
      { source: "github", signups: 2 },
      { source: "direct", signups: 1 },
      { source: "other-tagged", signups: 1 },
    ]);
    assert.deepEqual(summary.campaignCounts, [
      { source: "github", medium: "organic", campaign: "readme-cta", signups: 2 },
      { source: "direct", medium: "(not set)", campaign: "(not set)", signups: 1 },
      { source: "other-tagged", medium: "organic", campaign: "other-tagged", signups: 1 },
    ]);
    assert.equal(summary.dailySignups.find((day) => day.date === "2026-07-30")?.signups, 2);
    assert.equal(summary.dailySignups.find((day) => day.date === "2026-07-29")?.signups, 2);
    assert.equal(summary.timezone, "America/Los_Angeles");
    assert.equal(JSON.stringify(summary).includes("example.com"), false);
  });
});
