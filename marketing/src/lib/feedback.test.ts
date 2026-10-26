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
 * The feedback POST against one local server that plays both Supabase (PostgREST) and PostHog, so the
 * stored row and the analytics event are both visible. The privacy texts describe exactly this.
 */
describe("feedback POST: what is stored and what goes to analytics", () => {
  const ENV = {
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    POSTHOG_PROJECT_API_KEY: "phc_test",
    NEXT_PUBLIC_POSTHOG_KEY: undefined,
    POSTHOG_HOST: "",
    NEXT_PUBLIC_POSTHOG_HOST: undefined,
  };
  const previous: Record<string, string | undefined> = {};
  const rows: Record<string, unknown>[] = [];
  const events: { raw: string; body: { event: string; distinct_id: string; properties: Record<string, unknown> } }[] = [];
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
      if (request.method === "POST" && request.url === "/i/v0/e/") {
        events.push({ raw: body, body: JSON.parse(body) as (typeof events)[number]["body"] });
        response.writeHead(200, { "Content-Type": "application/json" }).end("{}");
        return;
      }
      response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const env = process.env as Record<string, string | undefined>;
    for (const [name, value] of Object.entries({ ...ENV, SUPABASE_URL: base, POSTHOG_HOST: base })) {
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

  it("stores a hash of the IP with the feedback, and sends the analytics event under a random ID per send", async () => {
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
    for (const row of rows) assert.equal(row.ip_hash, hashIp(ip), "the stored row keeps the IP hash");

    const sent = events.filter((e) => e.body.event === "feedback_submitted");
    assert.equal(sent.length, 2, "one feedback_submitted event per send");
    for (const { raw } of sent) assert.ok(!raw.includes(hashIp(ip)), `the analytics event never carries the IP hash: ${raw}`);
    const ids = sent.map((e) => e.body.distinct_id);
    for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, "the analytics ID is a random UUID");
    assert.notEqual(ids[0], ids[1], "two sends from one IP get different analytics IDs");
    assert.deepEqual(sent.map((e) => e.body.properties), [{ source: "app", rating: 4 }, { source: "app", rating: 5 }], "only the rating and where it came from");
  });
});
