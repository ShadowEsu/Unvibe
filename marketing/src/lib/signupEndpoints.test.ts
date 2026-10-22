import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import * as waitlistRoute from "../app/api/waitlist/route";
import * as betaDownloadRoute from "../app/api/beta-download/route";
import { GET as referralGET } from "../app/api/referrals/[code]/route";

/**
 * Public signup endpoints against a fake Supabase (PostgREST) project, so the real supabase-js
 * calls run end to end. The rate limit lives in that shared store, not in function memory.
 */

const SERVICE_KEY = "service-role-test-key";
const SITE = "https://unvibe.site";

type Row = Record<string, unknown> & { email: string; referral_code: string };

const waitlistRows = new Map<string, Row>();
const limiterHits = new Map<string, number>();
let limiterFails = false;
let server: Server;

async function readBody(request: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body;
}

function json(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { "Content-Type": "application/json", ...headers }).end(JSON.stringify(body));
}

before(async () => {
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const body = await readBody(request);
    if (request.headers.apikey !== SERVICE_KEY) return json(response, 401, { message: "bad key" });

    if (url.pathname === "/rest/v1/rpc/consume_rate_limit") {
      if (limiterFails) return json(response, 500, { code: "XX000", message: "limiter down" });
      const args = JSON.parse(body) as { p_bucket: string; p_window_seconds: number; p_max: number };
      const hits = (limiterHits.get(args.p_bucket) ?? 0) + 1;
      limiterHits.set(args.p_bucket, hits);
      return json(response, 200, hits <= args.p_max);
    }

    if (url.pathname === "/rest/v1/waitlist_entries") {
      if (request.method === "POST") {
        const row = JSON.parse(body) as Row;
        if (waitlistRows.has(row.email)) {
          return json(response, 409, { code: "23505", message: "duplicate key value violates unique constraint" });
        }
        waitlistRows.set(row.email, { id: row.email, ...row });
        response.writeHead(201).end();
        return;
      }
      if (request.method === "PATCH") return json(response, 200, [{ id: url.searchParams.get("email") }]);
      const email = url.searchParams.get("email")?.replace(/^eq\./, "");
      const rows = Array.from(waitlistRows.values()).filter((row) => !email || row.email === email);
      if (String(request.headers.accept ?? "").includes("vnd.pgrst.object")) {
        if (rows.length === 0) return json(response, 406, { code: "PGRST116", message: "no rows" });
        return json(response, 200, rows[0]);
      }
      return json(response, 200, rows);
    }

    if (url.pathname === "/rest/v1/gift_claims") {
      response.writeHead(200, { "Content-Range": "*/0", "Content-Type": "application/json" }).end("[]");
      return;
    }

    json(response, 200, []);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.SUPABASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  delete process.env.RESEND_API_KEY;
  delete process.env.VERCEL_ENV;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  limiterFails = false;
});

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

function post(path: string, body: unknown, init: { origin?: string | null; contentType?: string; ip?: string } = {}): Request {
  const headers = new Headers({ "x-forwarded-for": init.ip ?? nextIp() });
  if (init.origin !== null) headers.set("origin", init.origin ?? SITE);
  headers.set("content-type", init.contentType ?? "application/json");
  return new Request(`${SITE}${path}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("waitlist and beta-download reject cross-site posts", () => {
  it("rejects another site's Origin with 403", async () => {
    const waitlist = await waitlistRoute.POST(post("/api/waitlist", {}, { origin: "https://evil.example" }));
    assert.equal(waitlist.status, 403);
    const download = await betaDownloadRoute.POST(post("/api/beta-download", {}, { origin: "https://evil.example" }));
    assert.equal(download.status, 403);
  });

  it("rejects a post with no Origin with 403", async () => {
    const waitlist = await waitlistRoute.POST(post("/api/waitlist", {}, { origin: null }));
    assert.equal(waitlist.status, 403);
    const download = await betaDownloadRoute.POST(post("/api/beta-download", {}, { origin: null }));
    assert.equal(download.status, 403);
  });

  it("rejects a text/plain form post with 415", async () => {
    const waitlist = await waitlistRoute.POST(post("/api/waitlist", "{}", { contentType: "text/plain" }));
    assert.equal(waitlist.status, 415);
    const download = await betaDownloadRoute.POST(post("/api/beta-download", "{}", { contentType: "text/plain;charset=UTF-8" }));
    assert.equal(download.status, 415);
  });

  it("accepts the www origin and localhost outside production", async () => {
    const www = await waitlistRoute.POST(post("/api/waitlist", {}, { origin: "https://www.unvibe.site" }));
    assert.equal(www.status, 422);
    const local = await betaDownloadRoute.POST(post("/api/beta-download", {}, { origin: "http://localhost:3000" }));
    assert.equal(local.status, 422);
  });

  it("accepts only unvibe.site and www in production", async () => {
    process.env.VERCEL_ENV = "production";
    try {
      const local = await waitlistRoute.POST(post("/api/waitlist", {}, { origin: "http://localhost:3000" }));
      assert.equal(local.status, 403);
      const site = await waitlistRoute.POST(post("/api/waitlist", {}, { origin: SITE }));
      assert.equal(site.status, 422);
    } finally {
      delete process.env.VERCEL_ENV;
    }
  });
});

describe("the signup rate limit is shared across serverless instances", () => {
  it("waitlist: the 9th call from one IP is limited even when it lands on another instance", async () => {
    // A query-suffixed import loads a second, separate module instance, like a second serverless
    // instance. The specifier is a variable because TypeScript cannot resolve the query suffix.
    const specifier = "../app/api/waitlist/route?instance=2";
    const other = (await import(specifier)) as typeof waitlistRoute;
    assert.notEqual(other.POST, waitlistRoute.POST);
    const ip = nextIp();
    for (let call = 1; call <= 8; call += 1) {
      const response = await waitlistRoute.POST(post("/api/waitlist", {}, { ip }));
      assert.equal(response.status, 422, `call ${call}`);
    }
    const ninth = await other.POST(post("/api/waitlist", {}, { ip }));
    assert.equal(ninth.status, 429);
  });

  it("beta-download: the 7th call from one IP is limited even when it lands on another instance", async () => {
    // Second module instance, as above.
    const specifier = "../app/api/beta-download/route?instance=2";
    const other = (await import(specifier)) as typeof betaDownloadRoute;
    assert.notEqual(other.POST, betaDownloadRoute.POST);
    const ip = nextIp();
    for (let call = 1; call <= 6; call += 1) {
      const response = await betaDownloadRoute.POST(post("/api/beta-download", {}, { ip }));
      assert.equal(response.status, 422, `call ${call}`);
    }
    const seventh = await other.POST(post("/api/beta-download", {}, { ip }));
    assert.equal(seventh.status, 429);
  });

  it("limits one target email across many IPs and both routes", async () => {
    const email = "list-bomb-target@unvibe-mail.test";
    const statuses: number[] = [];
    for (let call = 1; call <= 5; call += 1) {
      statuses.push((await waitlistRoute.POST(post("/api/waitlist", { email }))).status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200]);
    const sixth = await betaDownloadRoute.POST(post("/api/beta-download", { email }));
    assert.equal(sixth.status, 429);
  });

  it("fails closed with 503 in production when the limiter store errors", async () => {
    const previous = process.env.NODE_ENV;
    limiterFails = true;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      const waitlist = await waitlistRoute.POST(post("/api/waitlist", {}));
      assert.equal(waitlist.status, 503);
      const download = await betaDownloadRoute.POST(post("/api/beta-download", {}));
      assert.equal(download.status, 503);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = previous;
    }
  });
});

describe("waitlist responses do not reveal membership", () => {
  it("answers a signup for a listed email exactly like a new one", async () => {
    const email = "first-time-reader@unvibe-mail.test";
    const first = await waitlistRoute.POST(post("/api/waitlist", { email }));
    assert.ok(waitlistRows.has(email), "the first call adds the row");
    const again = await waitlistRoute.POST(post("/api/waitlist", { email }));
    assert.equal(again.status, first.status);
    assert.deepEqual(await again.json(), await first.json());
  });

  it("has no unauthenticated details PATCH, so Next answers 405 for every email", () => {
    assert.equal("PATCH" in waitlistRoute, false);
  });

  it("answers an unknown referral code like a known one with no joins", async () => {
    const email = "has-a-referral-link@unvibe-mail.test";
    const code = createHash("sha256").update(email).digest("hex").slice(0, 8);
    waitlistRows.set(email, { id: email, email, referral_code: code, created_at: new Date().toISOString() });
    const unknownCode = code === "0badc0de" ? "1badc0de" : "0badc0de";
    const request = () => new Request(`${SITE}/api/referrals/x`, { headers: { "x-forwarded-for": nextIp() } });

    const known = await referralGET(request(), { params: { code } });
    const unknown = await referralGET(request(), { params: { code: unknownCode } });
    assert.equal(known.status, 200);
    assert.equal(unknown.status, known.status);
    assert.deepEqual(await unknown.json(), await known.json());
  });

  it("refuses the hidden founder metric addresses on beta-download", async () => {
    const response = await betaDownloadRoute.POST(post("/api/beta-download", { email: "growth-funnel@unvibe.internal" }));
    assert.equal(response.status, 422);
  });
});
