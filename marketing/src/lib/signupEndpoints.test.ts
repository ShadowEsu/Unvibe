import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import * as waitlistRoute from "../app/api/waitlist/route";
import * as betaDownloadRoute from "../app/api/beta-download/route";
import { GET as referralGET } from "../app/api/referrals/[code]/route";
import { BETA_INSTALL_TAG, BETA_MAC_DOWNLOAD_URL } from "./betaInstallScript";

/**
 * Public signup endpoints against a fake Supabase (PostgREST) project, so the real supabase-js
 * calls run end to end. The rate limit lives in that shared store, not in function memory.
 */

const SERVICE_KEY = "service-role-test-key";
const SITE = "https://unvibe.site";
const KEY_SECRET = ["rate", "limit", "key", "test"].join("-");

type Row = Record<string, unknown> & { email: string; referral_code: string };

const waitlistRows = new Map<string, Row>();
const limiterHits = new Map<string, number>();
/** Every bucket the routes asked the store to count, in order. */
const limiterBuckets: string[] = [];
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
      limiterBuckets.push(args.p_bucket);
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
  process.env.RATE_LIMIT_KEY_SECRET = KEY_SECRET;
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

describe("beta-download hands out the pinned release", () => {
  it("returns this release's Mac build even when the old override variables are set", async () => {
    // Production still has both names set from months ago; they must not decide what people get.
    process.env.NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL = "https://example.com/old-beta.dmg";
    process.env.NEXT_PUBLIC_INVESTOR_DMG_URL = "https://example.com/old-investor.dmg";
    try {
      const response = await betaDownloadRoute.POST(post("/api/beta-download", { email: "pinned-build@example.com" }));
      assert.equal(response.status, 200);
      const body = (await response.json()) as { downloadUrl?: string };
      assert.equal(body.downloadUrl, BETA_MAC_DOWNLOAD_URL);
    } finally {
      delete process.env.NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL;
      delete process.env.NEXT_PUBLIC_INVESTOR_DMG_URL;
    }
  });

  it("emails this release's Mac build under a send key that names the release", async () => {
    process.env.NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL = "https://example.com/old-beta.dmg";
    process.env.NEXT_PUBLIC_INVESTOR_DMG_URL = "https://example.com/old-investor.dmg";
    process.env.RESEND_API_KEY = "resend-test-key";
    // Capture what would go to Resend; everything else (the fake Supabase) goes through as usual.
    const emails: { key: string | null; html: string; text: string }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url !== "https://api.resend.com/emails") return realFetch(input, init);
      const body = JSON.parse(String(init?.body)) as { html: string; text: string };
      emails.push({ key: new Headers(init?.headers).get("idempotency-key"), html: body.html, text: body.text });
      return Response.json({ id: `email-${emails.length}` });
    }) as typeof fetch;
    try {
      // A fresh address each run: the local download store (.data) remembers who was already emailed.
      const response = await betaDownloadRoute.POST(post("/api/beta-download", { email: `pinned-email-${randomUUID()}@example.com` }));
      assert.equal(response.status, 200);
      const welcome = emails.find((sent) => sent.key?.startsWith("unvibe-welcome-"));
      assert.ok(welcome, "the welcome email was sent");
      assert.ok(welcome.html.includes(BETA_MAC_DOWNLOAD_URL), "the HTML email links the pinned build");
      assert.ok(welcome.text.includes(BETA_MAC_DOWNLOAD_URL), "the text email links the pinned build");
      assert.ok(!`${welcome.html}${welcome.text}`.includes("example.com/old-"), "no override URL in the email");
      assert.ok(welcome.key?.startsWith(`unvibe-welcome-${BETA_INSTALL_TAG.replace(/^v/, "")}-`), `send key names the release: ${welcome.key}`);
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.RESEND_API_KEY;
      delete process.env.NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL;
      delete process.env.NEXT_PUBLIC_INVESTOR_DMG_URL;
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

/** Runs a scripted post (curl can send any Origin) and returns the per-minute IP bucket it was counted in. */
async function waitlistIpBucket(ip: string): Promise<string> {
  limiterBuckets.length = 0;
  await waitlistRoute.POST(post("/api/waitlist", {}, { ip }));
  const bucket = limiterBuckets.find((name) => name.startsWith("waitlist-ip:"));
  assert.ok(bucket, `no waitlist-ip bucket for ${ip}`);
  return bucket;
}

async function withEnv<T>(values: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
  const env = process.env as Record<string, string | undefined>;
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
  try {
    return await run();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete env[name];
      else env[name] = value;
    }
  }
}

describe("scripted signups are capped per network, per day and overall", () => {
  it("groups IPv6 by /64 and counts IPv4-mapped IPv6 as the IPv4", async () => {
    const network = await waitlistIpBucket("2001:db8:1:2::1");
    // Same /64, written with :: compression, full zero-padded form, mixed case, brackets and a zone id.
    assert.equal(await waitlistIpBucket("2001:0db8:0001:0002:ffff:eeee:dddd:cccc"), network);
    assert.equal(await waitlistIpBucket("2001:DB8:1:2:a::b"), network);
    assert.equal(await waitlistIpBucket("[2001:db8:1:2::99]"), network);
    assert.equal(await waitlistIpBucket("2001:db8:1:2::1%eth0"), network);
    assert.equal(await waitlistIpBucket("2001:db8:1:2:0:0:0.0.0.1"), network, "a trailing dotted quad is two hextets of the interface id");
    // Different /64s.
    assert.notEqual(await waitlistIpBucket("2001:db8:1:3::1"), network);
    assert.notEqual(await waitlistIpBucket("2001:db8::1"), network);
    assert.notEqual(await waitlistIpBucket("2001:db8:1::2:1"), network, ":: placement changes which hextets form the /64");
    // IPv4 is unchanged and the mapped forms equal it.
    const v4 = await waitlistIpBucket("198.51.100.7");
    assert.equal(await waitlistIpBucket("::ffff:198.51.100.7"), v4);
    assert.equal(await waitlistIpBucket("::FFFF:c633:6407"), v4);
    assert.equal(await waitlistIpBucket("0:0:0:0:0:ffff:198.51.100.7"), v4);
    assert.notEqual(await waitlistIpBucket("198.51.100.8"), v4);
    assert.notEqual(await waitlistIpBucket("::ffff:198.51.100.8"), v4);
  });

  it("rotating addresses inside one /64 shares the per-minute limit", async () => {
    for (let call = 1; call <= 8; call += 1) {
      const response = await waitlistRoute.POST(post("/api/waitlist", {}, { ip: `2001:db8:77:1::${call.toString(16)}` }));
      assert.equal(response.status, 422, `call ${call}`);
    }
    const ninth = await waitlistRoute.POST(post("/api/waitlist", {}, { ip: "2001:db8:77:1:ffff::9" }));
    assert.equal(ninth.status, 429);
  });

  it("caps one network per day across both forms (SIGNUP_IP_DAILY_LIMIT)", async () => {
    await withEnv({ SIGNUP_IP_DAILY_LIMIT: "3" }, async () => {
      const statuses = [
        (await waitlistRoute.POST(post("/api/waitlist", {}, { ip: "2001:db8:88:1::1" }))).status,
        (await betaDownloadRoute.POST(post("/api/beta-download", {}, { ip: "2001:db8:88:1::2" }))).status,
        (await waitlistRoute.POST(post("/api/waitlist", {}, { ip: "2001:db8:88:1::3" }))).status,
      ];
      assert.deepEqual(statuses, [422, 422, 422]);
      const fourth = await betaDownloadRoute.POST(post("/api/beta-download", {}, { ip: "2001:db8:88:1:abcd::4" }));
      assert.equal(fourth.status, 429);
    });
  });

  it("stops signup email for everyone at the daily ceiling with a plain 503 (SIGNUP_EMAIL_DAILY_CEILING)", async () => {
    limiterHits.clear();
    await withEnv({ SIGNUP_EMAIL_DAILY_CEILING: "2" }, async () => {
      const first = await waitlistRoute.POST(post("/api/waitlist", { email: "ceiling-one@unvibe-mail.test" }));
      const second = await waitlistRoute.POST(post("/api/waitlist", { email: "ceiling-two@unvibe-mail.test" }));
      assert.deepEqual([first.status, second.status], [200, 200]);
      const third = await waitlistRoute.POST(post("/api/waitlist", { email: "ceiling-three@unvibe-mail.test" }));
      assert.equal(third.status, 503);
      assert.match((await third.json() as { error: string }).error, /try again tomorrow/i);
      const fourth = await betaDownloadRoute.POST(post("/api/beta-download", { email: "ceiling-four@unvibe-mail.test" }));
      assert.equal(fourth.status, 503);
    });
  });

  it("keys buckets with an HMAC of a server secret, not a plain sha256", async () => {
    const ip = "198.51.100.42";
    const bucket = await waitlistIpBucket(ip);
    const plainSha = createHash("sha256").update(`waitlist-ip:${ip}`).digest("hex").slice(0, 32);
    assert.ok(!bucket.includes(plainSha), "the old unsalted hash can be brute-forced from a dump");
    assert.ok(!bucket.includes(ip));
    const otherSecret = await withEnv({ RATE_LIMIT_KEY_SECRET: `${KEY_SECRET}-rotated` }, () => waitlistIpBucket(ip));
    assert.notEqual(otherSecret, bucket, "the secret must be part of the key");
  });

  it("fails closed when deployed without RATE_LIMIT_KEY_SECRET", async () => {
    await withEnv({ RATE_LIMIT_KEY_SECRET: undefined, NODE_ENV: "production" }, async () => {
      const waitlist = await waitlistRoute.POST(post("/api/waitlist", {}));
      assert.equal(waitlist.status, 503);
      const download = await betaDownloadRoute.POST(post("/api/beta-download", {}));
      assert.equal(download.status, 503);
    });
    await withEnv({ NODE_ENV: "production" }, async () => {
      const withSecret = await waitlistRoute.POST(post("/api/waitlist", {}));
      assert.equal(withSecret.status, 422);
    });
  });
});
