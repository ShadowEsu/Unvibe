import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONSENT_ANSWER_MAX_BYTES, handleConsentAnswer, parseConsentAnswer } from "@/lib/consentAnswers";

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://unvibe.site/api/consent/answer", { method: "POST", body, headers });
}

function spyRpc() {
  const calls: Array<[string, string]> = [];
  const rpc = async (day: string, answer: string) => {
    calls.push([day, answer]);
    return { error: null };
  };
  return { calls, rpc };
}

describe("consent answer count (Security C-3, C-4)", () => {
  it("accepts exactly {answer: allow|deny} and nothing else", () => {
    assert.equal(parseConsentAnswer('{"answer":"allow"}'), "allow");
    assert.equal(parseConsentAnswer('{"answer":"deny"}'), "deny");
    for (const bad of ['{"answer":"ask"}', '{"choice":"allow"}', '{"answer":"allow","id":"x"}', '["allow"]', '"allow"', "allow", "", "null"]) {
      assert.equal(parseConsentAnswer(bad), null, bad);
    }
  });

  it("counts one answer for the server's Pacific day, and passes nothing else to storage", async () => {
    const { calls, rpc } = spyRpc();
    // 06:30 UTC on 1 Nov is 23:30 PDT on 31 Oct.
    const status = await handleConsentAnswer(post('{"answer":"deny"}'), rpc, new Date("2026-11-01T06:30:00Z"));
    assert.equal(status, 204);
    assert.deepEqual(calls, [["2026-10-31", "deny"]]);
  });

  it("ignores every header: identifying headers change nothing that is stored", async () => {
    const { calls, rpc } = spyRpc();
    const req = post('{"answer":"allow"}', {
      "x-forwarded-for": "203.0.113.7",
      "user-agent": "Probe/1.0",
      referer: "https://unvibe.site/pricing?email=a@b.c",
      cookie: "unvibe_anon_id=abc",
    });
    assert.equal(await handleConsentAnswer(req, rpc, new Date("2026-10-30T18:00:00Z")), 204);
    assert.deepEqual(calls, [["2026-10-30", "allow"]]);
  });

  it("refuses a malformed or oversized body without counting", async () => {
    const { calls, rpc } = spyRpc();
    assert.equal(await handleConsentAnswer(post('{"answer":"maybe"}'), rpc), 400);
    assert.equal(await handleConsentAnswer(post("not json"), rpc), 400);
    const padded = `{"answer":"allow"${" ".repeat(CONSENT_ANSWER_MAX_BYTES)}}`;
    assert.equal(await handleConsentAnswer(post(padded), rpc), 400);
    assert.equal(calls.length, 0);
  });

  it("answers 503 when storage is missing or fails", async () => {
    assert.equal(await handleConsentAnswer(post('{"answer":"allow"}'), null), 503);
    const failing = async () => ({ error: new Error("db down") });
    assert.equal(await handleConsentAnswer(post('{"answer":"allow"}'), failing), 503);
  });
});
