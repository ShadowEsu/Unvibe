import test, { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { POST } from "../app/feedback/route";
import { cleanText, feedbackSchema, hashIp, wordCount } from "./feedback";

test("word count ignores extra spaces", () => {
  assert.equal(wordCount("  hello   there  "), 2);
  assert.equal(wordCount(""), 0);
});

test("feedback accepts stars and a short note", () => {
  const parsed = feedbackSchema.safeParse({ rating: 5, message: "Love it" });
  assert.ok(parsed.success);
});

test("feedback rejects bad ratings, long notes and filled honeypots", () => {
  assert.equal(feedbackSchema.safeParse({ rating: 0 }).success, false);
  assert.equal(feedbackSchema.safeParse({ rating: 6 }).success, false);
  assert.equal(feedbackSchema.safeParse({ rating: 3, message: Array(101).fill("word").join(" ") }).success, false);
  assert.equal(feedbackSchema.safeParse({ rating: 3, website: "spam.example" }).success, false);
});

test("cleanText strips control characters", () => {
  assert.equal(cleanText("hi\u0000 there\n\nfriend"), "hi there friend");
});

/**
 * The feedback POST against one local server that plays Supabase (PostgREST) and Mixpanel, and logs
 * every other request, so the stored row and anything sent to analytics are both visible. The
 * privacy texts describe exactly this.
 */
describe("feedback POST: what is stored and what goes to analytics", () => {
  const ENV = {
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    MIXPANEL_TOKEN: "mp_test",
    MIXPANEL_HOST: "",
  };
  const previous: Record<string, string | undefined> = {};
  const rows: Record<string, unknown>[] = [];
  /** Every request that is not the feedback insert: analytics sends, or anything else. */
  const otherRequests: string[] = [];
  let server: Server;

  before(async () => {
    server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      if (request.method === "POST" && request.url?.startsWith("/rest/v1/site_feedback")) {
        rows.push(JSON.parse(body) as Record<string, unknown>);
        response.writeHead(201).end();
        return;
      }
      otherRequests.push(`${request.method} ${request.url}`);
      response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const env = process.env as Record<string, string | undefined>;
    for (const [name, value] of Object.entries({ ...ENV, SUPABASE_URL: base, MIXPANEL_HOST: base })) {
      previous[name] = env[name];
      if (value === undefined) delete env[name];
      else env[name] = value;
    }
  });

  after(async () => {
    const env = process.env as Record<string, string | undefined>;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete env[name];
      else env[name] = value;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("stores no IP or IP hash with the feedback, and sends nothing to analytics", async () => {
    const ip = "198.51.100.23";
    for (const rating of [4, 5]) {
      const response = await POST(
        new Request("https://unvibe.site/feedback", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ rating, message: "Clear and quick", source: "app", appVersion: "0.1.44" }),
        }),
      );
      assert.equal(response.status, 200, await response.clone().text());
    }

    assert.equal(rows.length, 2, "both sends are stored");
    for (const row of rows) {
      assert.ok(row.ip_hash === undefined || row.ip_hash === null, `the stored row has no ip_hash: ${JSON.stringify(row)}`);
      const stored = JSON.stringify(row);
      assert.ok(!stored.includes(ip) && !stored.includes(hashIp(ip)), `the stored row carries neither the IP nor its hash: ${stored}`);
    }

    assert.deepEqual(otherRequests, [], "no analytics request, Mixpanel or any other, for a feedback send");
  });

  it("still refuses a sixth send from one IP within ten minutes, from memory, without storing it", async () => {
    const ip = "198.51.100.77";
    const before = rows.length;
    const statuses: number[] = [];
    for (let send = 1; send <= 6; send += 1) {
      const response = await POST(
        new Request("https://unvibe.site/feedback", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ rating: 3 }),
        }),
      );
      statuses.push(response.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429], "five sends pass, the sixth is limited");
    assert.equal(rows.length - before, 5, "the limited send is not stored");
  });
});
