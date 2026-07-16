import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notifyFounder, type FounderNotificationInput } from "./notifyWaitlist";

const entry: FounderNotificationInput = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  referralCode: "abc12345",
  duplicate: false,
};

describe("notifyFounder", () => {
  it("uses Resend with an idempotency key when configured", async () => {
    const originalFetch = global.fetch;
    const previousKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test";
    let request: { url: string; options?: RequestInit } | undefined;
    global.fetch = async (input, options) => {
      request = { url: String(input), options };
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    };
    try {
      const result = await notifyFounder(entry);
      assert.equal(result.status, "sent");
      assert.equal(result.provider, "resend");
      assert.equal(result.messageId, "email_123");
      assert.equal(request?.url, "https://api.resend.com/emails");
      assert.equal((request?.options?.headers as Record<string, string>)["Idempotency-Key"], "unvibe-waitlist-abc12345");
    } finally {
      global.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previousKey;
    }
  });

  it("falls back to FormSubmit when Resend is not configured", async () => {
    const originalFetch = global.fetch;
    const previousKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    let requestUrl = "";
    global.fetch = async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };
    try {
      const result = await notifyFounder(entry);
      assert.equal(result.status, "sent");
      assert.equal(result.provider, "formsubmit");
      assert.match(requestUrl, /^https:\/\/formsubmit\.co\/ajax\//);
    } finally {
      global.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previousKey;
    }
  });
});
