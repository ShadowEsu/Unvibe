import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as surveyRoute from "@/app/api/survey/route";
import type { RateLimitDecision, RateLimitRule } from "@/lib/rateLimit";
import { handleWebSurvey, WEB_SURVEY_DAILY_LIMIT, WEB_SURVEY_IP_LIMIT, type WebSurveyDeps, type WebSurveyRow } from "@/lib/webSurvey";

function harness(decisions: Partial<Record<string, RateLimitDecision>> = {}, store: "stored" | "unavailable" | "throw" = "stored") {
  const rows: WebSurveyRow[] = [];
  const consumed: string[] = [];
  let n = 0;
  const deps: WebSurveyDeps = {
    consume: async (rule: RateLimitRule) => {
      consumed.push(rule.name);
      return decisions[rule.name] ?? "allowed";
    },
    store: async (row) => {
      if (store === "throw") throw new Error("down");
      rows.push(row);
      return store;
    },
    newInstallKey: () => (++n).toString(16).padStart(64, "0"),
  };
  return { deps, rows, consumed };
}

function post(body: unknown, init: { origin?: string | null; type?: string; raw?: string } = {}) {
  const headers = new Headers({ "content-type": init.type ?? "application/json" });
  if (init.origin !== null) headers.set("origin", init.origin ?? "https://unvibe.site");
  return new Request("https://unvibe.site/api/survey", { method: "POST", headers, body: init.raw ?? JSON.stringify(body) });
}

describe("web PMF survey", () => {
  it("has no GET handler, so opening a link can never record an answer (Security W1)", () => {
    assert.deepEqual(Object.keys(surveyRoute).filter((k) => /^(GET|HEAD|PUT|PATCH|DELETE)$/.test(k)), []);
    assert.equal(typeof surveyRoute.POST, "function");
  });

  it("stores one anonymous row per Send, with a fresh random key and the comment in q4", async () => {
    const h = harness();
    const first = await handleWebSurvey(post({ answer: "very", comment: "  More   languages\nplease " }), h.deps);
    assert.equal(first.status, 201);
    const second = await handleWebSurvey(post({ answer: "somewhat" }), h.deps);
    assert.equal(second.status, 201);
    assert.deepEqual(h.rows.map((r) => [r.q1, r.q4]), [["very", "More languages please"], ["somewhat", ""]]);
    assert.notEqual(h.rows[0].installKey, h.rows[1].installKey);
    assert.deepEqual(h.consumed, [WEB_SURVEY_IP_LIMIT.name, WEB_SURVEY_DAILY_LIMIT.name, WEB_SURVEY_IP_LIMIT.name, WEB_SURVEY_DAILY_LIMIT.name]);
  });

  it("stores both N/A answers as na, which the score leaves out", async () => {
    const h = harness();
    for (const answer of ["no-longer", "not-yet"]) assert.equal((await handleWebSurvey(post({ answer }), h.deps)).status, 201);
    assert.deepEqual(h.rows.map((r) => r.q1), ["na", "na"]);
  });

  it("refuses unknown keys, other answers, a missing answer and bad JSON with 400, storing nothing", async () => {
    const h = harness();
    const cases = [
      post({ answer: "very", email: "a@b.co" }),
      post({ answer: "na" }),
      post({ comment: "hi" }),
      post({ answer: 1 }),
      post(null, { raw: "{not json" }),
    ];
    for (const request of cases) assert.equal((await handleWebSurvey(request, h.deps)).status, 400);
    assert.equal(h.rows.length, 0);
  });

  it("takes a 2,000-character comment and refuses 2,001", async () => {
    const h = harness();
    assert.equal((await handleWebSurvey(post({ answer: "not", comment: "x".repeat(2000) }), h.deps)).status, 201);
    const long = await handleWebSurvey(post({ answer: "not", comment: "x".repeat(2001) }), h.deps);
    assert.equal(long.status, 400);
    assert.match(((await long.json()) as { error: string }).error, /2,000/);
    assert.equal(h.rows.length, 1);
  });

  it("only takes JSON posts from unvibe.site's own pages, before counting or storing", async () => {
    const h = harness();
    assert.equal((await handleWebSurvey(post({ answer: "very" }, { origin: "https://evil.example" }), h.deps)).status, 403);
    assert.equal((await handleWebSurvey(post({ answer: "very" }, { origin: null }), h.deps)).status, 403);
    assert.equal((await handleWebSurvey(post({ answer: "very" }, { type: "text/plain" }), h.deps)).status, 415);
    assert.deepEqual([h.consumed.length, h.rows.length], [0, 0]);
  });

  it("refuses a body over 16 KB with 413", async () => {
    const h = harness();
    const response = await handleWebSurvey(post(null, { raw: JSON.stringify({ answer: "very", comment: "é".repeat(9000) }) }), h.deps);
    assert.equal(response.status, 413);
    assert.equal(h.rows.length, 0);
  });

  it("answers 429 when this network or everyone is over the limit, and 503 when the limiter is down", async () => {
    const cases: [Partial<Record<string, RateLimitDecision>>, number][] = [
      [{ [WEB_SURVEY_IP_LIMIT.name]: "limited" }, 429],
      [{ [WEB_SURVEY_DAILY_LIMIT.name]: "limited" }, 429],
      [{ [WEB_SURVEY_IP_LIMIT.name]: "unavailable" }, 503],
      [{ [WEB_SURVEY_DAILY_LIMIT.name]: "unavailable" }, 503],
    ];
    for (const [decisions, status] of cases) {
      const h = harness(decisions);
      assert.equal((await handleWebSurvey(post({ answer: "very" }), h.deps)).status, status);
      assert.equal(h.rows.length, 0);
    }
  });

  it("answers 503, never 500, when the store fails or throws", async () => {
    assert.equal((await handleWebSurvey(post({ answer: "very" }), harness({}, "unavailable").deps)).status, 503);
    assert.equal((await handleWebSurvey(post({ answer: "very" }), harness({}, "throw").deps)).status, 503);
  });
});
