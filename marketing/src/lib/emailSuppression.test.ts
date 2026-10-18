import { after, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { suppressionKey, unsubscribeUrl } from "./unsubscribe";
import { POST } from "../app/api/unsubscribe/route";
import { isEmailUnsubscribed, listUnsubscribedKeys, recordEmailUnsubscribe } from "./waitlistStore";

/**
 * The store boundary here is Supabase's REST API: a fake PostgREST for public.email_suppression
 * stands in for the project, so the real supabase-js calls in waitlistStore run end to end.
 */

const SERVICE_KEY = "service-role-test-key";

interface Write {
  query: URLSearchParams;
  prefer: string;
  body: string;
}

const rows = new Map<string, string>();
const writes: Write[] = [];
let failRequests = false;
let server: Server;

async function readBody(request: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body;
}

before(async () => {
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const body = await readBody(request);
    if (url.pathname !== "/rest/v1/email_suppression" || request.headers.apikey !== SERVICE_KEY) {
      response.writeHead(404).end();
      return;
    }
    if (failRequests) {
      response.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ code: "XX000", message: "store down" }));
      return;
    }
    if (request.method === "POST") {
      writes.push({ query: url.searchParams, prefer: String(request.headers.prefer ?? ""), body });
      const parsed = JSON.parse(body) as { email_hash: string; unsubscribed_at: string } | { email_hash: string; unsubscribed_at: string }[];
      for (const row of Array.isArray(parsed) ? parsed : [parsed]) if (!rows.has(row.email_hash)) rows.set(row.email_hash, row.unsubscribed_at);
      response.writeHead(201).end();
      return;
    }
    const eq = url.searchParams.get("email_hash");
    const hashes = Array.from(rows.keys()).sort().filter((hash) => !eq || eq === `eq.${hash}`);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? hashes.length);
    const page = hashes.slice(offset, offset + limit).map((email_hash) => ({ email_hash }));
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(page));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.SUPABASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  process.env.REWARD_LINK_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://unvibe.site";
  delete process.env.RESEND_API_KEY;
});

after(() => {
  server.close();
});

beforeEach(() => {
  rows.clear();
  writes.length = 0;
  failRequests = false;
});

describe("email suppression in Supabase", () => {
  it("upserts only the hash, ignoring duplicates, and reads it back for any casing", async () => {
    await recordEmailUnsubscribe(" Friend@Example.com ", "2026-10-18T10:00:00.000Z");
    await recordEmailUnsubscribe("friend@example.com", "2026-10-18T11:00:00.000Z");

    const key = suppressionKey("friend@example.com");
    assert.deepEqual(Array.from(rows.entries()), [[key, "2026-10-18T10:00:00.000Z"]]);
    assert.equal(writes.length, 2);
    assert.equal(writes[0].query.get("on_conflict"), "email_hash");
    assert.match(writes[0].prefer, /resolution=ignore-duplicates/);
    assert.doesNotMatch(writes[0].body, /example\.com/i);

    assert.equal(await isEmailUnsubscribed("FRIEND@example.com"), true);
    assert.equal(await isEmailUnsubscribed("someone@else.com"), false);
  });

  it("throws when the write fails", async () => {
    failRequests = true;
    await assert.rejects(recordEmailUnsubscribe("friend@example.com", "2026-10-18T10:00:00.000Z"), /Supabase unsubscribe write failed: store down/);
  });

  it("fails open on a single read error, and logs it", async () => {
    const logged = mock.method(console, "error", () => undefined);
    try {
      failRequests = true;
      assert.equal(await isEmailUnsubscribed("friend@example.com"), false);
      assert.equal(logged.mock.callCount(), 1);
      assert.equal(logged.mock.calls[0].arguments[0], "unsubscribe check failed");
    } finally {
      logged.mock.restore();
    }
  });

  it("lists every hash across pages for the invite script", async () => {
    const expected = new Set<string>();
    for (let index = 0; index < 1001; index += 1) {
      const key = suppressionKey(`person${index}@example.com`);
      rows.set(key, "2026-10-18T10:00:00.000Z");
      expected.add(key);
    }
    assert.deepEqual(await listUnsubscribedKeys(), expected);
  });

  it("fails closed on a list error", async () => {
    failRequests = true;
    await assert.rejects(listUnsubscribedKeys(), /Supabase unsubscribe list failed: store down/);
  });
});

describe("unsubscribe route with Supabase", () => {
  it("POST records the hash and confirms", async () => {
    const response = await POST(new Request(unsubscribeUrl("friend@example.com"), { method: "POST", body: "List-Unsubscribe=One-Click" }));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /You're unsubscribed/);
    assert.ok(rows.has(suppressionKey("friend@example.com")));
  });

  it("POST returns the 500 page, not success, when the write fails", async () => {
    const logged = mock.method(console, "error", () => undefined);
    try {
      failRequests = true;
      const response = await POST(new Request(unsubscribeUrl("friend@example.com"), { method: "POST", body: "List-Unsubscribe=One-Click" }));
      assert.equal(response.status, 500);
      const html = await response.text();
      assert.match(html, /We could not save that/);
      assert.doesNotMatch(html, /You're unsubscribed/);
      assert.equal(logged.mock.calls[0].arguments[0], "unsubscribe record failed");
    } finally {
      logged.mock.restore();
    }
  });
});
