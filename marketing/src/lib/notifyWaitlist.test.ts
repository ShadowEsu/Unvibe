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
  it("uses Resend with an idempotency key and always alerts the founder inbox", async () => {
    const originalFetch = global.fetch;
    const previousKey = process.env.RESEND_API_KEY;
    const previousTo = process.env.WAITLIST_NOTIFY_EMAIL;
    process.env.RESEND_API_KEY = "re_test";
    process.env.WAITLIST_NOTIFY_EMAIL = "someone-else@example.com";
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
      assert.equal(
        (request?.options?.headers as Record<string, string>)["Idempotency-Key"],
        "unvibe-waitlist-abc12345",
      );
      const body = JSON.parse(String(request?.options?.body)) as { to: string[] };
      assert.deepEqual(body.to, ["preston@unvibe.site"]);
    } finally {
      global.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previousKey;
      if (previousTo === undefined) delete process.env.WAITLIST_NOTIFY_EMAIL;
      else process.env.WAITLIST_NOTIFY_EMAIL = previousTo;
    }
  });

  it("fails closed when Resend is not configured instead of using FormSubmit", async () => {
    const previousKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const result = await notifyFounder(entry);
      assert.equal(result.status, "failed");
      assert.equal(result.provider, "none");
    } finally {
      if (previousKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previousKey;
    }
  });

  it("records a failed Resend delivery without throwing", async () => {
    const originalFetch = global.fetch;
    const previousKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test";
    global.fetch = async () => new Response(JSON.stringify({ message: "invalid" }), { status: 403 });
    try {
      const result = await notifyFounder(entry);
      assert.equal(result.status, "failed");
      assert.equal(result.provider, "resend");
    } finally {
      global.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previousKey;
    }
  });
});
