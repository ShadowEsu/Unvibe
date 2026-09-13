import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  hashUnsubscribeToken,
  isDispatchEligible,
  isStopRequest,
  normalizeOutreachEmail,
  OUTREACH_WEBSITE_LINE,
  remainingDailyOutreachQuota,
  validateOutreachDraft,
  verifyAgentMailWebhookSignature,
} from "./outreachCompliance";

test("normalizes formatted mailbox values", () => {
  assert.equal(normalizeOutreachEmail("Ada Builder <Ada@example.com>"), "ada@example.com");
});

test("recognizes clear stop requests", () => {
  assert.equal(isStopRequest("Please remove me from this list."), true);
  assert.equal(isStopRequest("Interesting project, thank you."), false);
});

test("requires research, sender address, and Unvibe-only links", () => {
  const valid = validateOutreachDraft({
    email: "ada@example.com",
    sourcePlatform: "github",
    sourceUrl: "https://github.com/ada/example",
    researchNote: "Built a public CLI that summarizes pull-request diffs for student teams.",
    fitScore: 82,
    subject: "Quick note about your diff-review CLI",
    bodyText: `Hi Ada — your project is thoughtful. Unvibe helps builders understand AI-written code.\n\n${OUTREACH_WEBSITE_LINE}\n\n123 Main St, San Francisco, CA 94105\nReply stop or unsubscribe: https://unvibe.site/unsubscribe?t=abc`,
    postalAddress: "123 Main St, San Francisco, CA 94105",
    unsubscribeUrl: "https://unvibe.site/unsubscribe?t=abc",
  });
  assert.equal(valid.valid, true);

  const invalid = validateOutreachDraft({
    email: "ada@example.com",
    sourcePlatform: "github",
    sourceUrl: "https://github.com/ada/example",
    researchNote: "too short",
    fitScore: 82,
    subject: "Hi",
    bodyText: "https://example.com",
    postalAddress: "",
    unsubscribeUrl: "https://unvibe.site/unsubscribe?t=abc",
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 3);
});

test("requires a clearly labeled standalone website line", () => {
  const result = validateOutreachDraft({
    email: "ada@example.com",
    sourcePlatform: "github",
    sourceUrl: "https://github.com/ada/example",
    researchNote: "Built a public CLI that summarizes pull-request diffs for student teams.",
    fitScore: 82,
    subject: "Quick note about your diff-review CLI",
    bodyText: "Hi Ada — see https://unvibe.site/ whenever you have a moment.\n\n123 Main St, San Francisco, CA 94105\nReply stop or unsubscribe: https://unvibe.site/unsubscribe?t=abc",
    postalAddress: "123 Main St, San Francisco, CA 94105",
    unsubscribeUrl: "https://unvibe.site/unsubscribe?t=abc",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes(`Email must include its own line: ${OUTREACH_WEBSITE_LINE}`));
});

test("unsubscribe hashing is deterministic", () => {
  assert.equal(hashUnsubscribeToken("token"), hashUnsubscribeToken("token"));
});

test("enforces the daily quota across repeated scheduler runs", () => {
  assert.equal(remainingDailyOutreachQuota(0), 15);
  assert.equal(remainingDailyOutreachQuota(14), 1);
  assert.equal(remainingDailyOutreachQuota(15), 0);
  assert.equal(remainingDailyOutreachQuota(200), 0);
});

test("allows only one first touch and a delayed second touch", () => {
  const now = new Date("2026-08-29T17:00:00.000Z");
  assert.equal(isDispatchEligible({ sequence: 1, contactStatus: "approved", followUpEligibleAt: null, now }), true);
  assert.equal(isDispatchEligible({ sequence: 1, contactStatus: "sent", followUpEligibleAt: null, now }), false);
  assert.equal(isDispatchEligible({ sequence: 2, contactStatus: "sent", followUpEligibleAt: "2026-08-29T17:00:01.000Z", now }), false);
  assert.equal(isDispatchEligible({ sequence: 2, contactStatus: "sent", followUpEligibleAt: "2026-08-29T16:59:59.000Z", now }), true);
});

test("accepts only a fresh AgentMail Svix signature for the exact raw body", () => {
  const signingKey = Buffer.from("agentmail-test-signing-key");
  const secret = `whsec_${signingKey.toString("base64")}`;
  const messageId = "msg_test_123";
  const timestamp = "1760000000";
  const rawBody = '{"event_type":"message.received","event_id":"evt_test"}';
  const signature = createHmac("sha256", signingKey)
    .update(`${messageId}.${timestamp}.${rawBody}`)
    .digest("base64");

  assert.equal(verifyAgentMailWebhookSignature({
    rawBody,
    messageId,
    timestamp,
    signature: `v1,${signature}`,
    secret,
    nowSeconds: 1760000001,
  }), true);
  assert.equal(verifyAgentMailWebhookSignature({
    rawBody: `${rawBody} `,
    messageId,
    timestamp,
    signature: `v1,${signature}`,
    secret,
    nowSeconds: 1760000001,
  }), false);
});
