// First import: unsets the analytics keys a developer shell may export, so a signup can't send a real event.
import { ANALYTICS_KEYS, restoreAnalyticsKeys } from "./testWithoutAnalyticsKeys";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import * as waitlistRoute from "../app/api/waitlist/route";
import * as betaDownloadRoute from "../app/api/beta-download/route";
import { GET as referralGET } from "../app/api/referrals/[code]/route";
import { BETA_INSTALL_TAG, BETA_MAC_DOWNLOAD_URL } from "./betaInstallScript";
import { NEWSLETTER_CONSENT_VERSION } from "./newsletterConsent";
import { betaInviteCandidates } from "./betaInviteSelection";
import { listWaitlistEntries } from "./waitlistStore";

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
/** Mixpanel (/track) captures, when a test points its host here. */
const analyticsHits: string[] = [];
/** Writes to the growth funnel's sentinel row. */
let funnelHits = 0;
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
    if (url.pathname === "/track") {
      analyticsHits.push(url.pathname);
      return json(response, 200, 1);
    }
    if (`${url.search} ${body}`.includes("growth-funnel%40unvibe.internal") || body.includes("growth-funnel@unvibe.internal")) funnelHits += 1;
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
      const email = url.searchParams.get("email")?.replace(/^eq\./, "");
      if (request.method === "PATCH") {
        const row = email ? waitlistRows.get(email) : undefined;
        // PostgREST `column=is.null` filters: the update only applies while those columns are empty.
        const nullFilters = Array.from(url.searchParams).filter(([, value]) => value === "is.null").map(([column]) => column);
        if (row && nullFilters.every((column) => row[column] == null)) Object.assign(row, JSON.parse(body) as Record<string, unknown>);
        return json(response, 200, [{ id: email }]);
      }
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
  // With a real Blob token the download store would write test records to the real Blob store.
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.RATE_LIMIT_KEY_SECRET = KEY_SECRET;
});

after(async () => {
  restoreAnalyticsKeys();
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

it("runs with every analytics key unset, so a successful signup sends no real event", () => {
  for (const name of ANALYTICS_KEYS) assert.equal(process.env[name], undefined, `${name} is unset during these tests`);
});

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
  // The old override names are set the way production still has them; withEnv puts back whatever
  // values they had before, so no other test sees a change.
  const OLD_OVERRIDES = {
    NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL: "https://example.com/old-beta.dmg",
    NEXT_PUBLIC_INVESTOR_DMG_URL: "https://example.com/old-investor.dmg",
  };

  it("returns this release's Mac build even when the old override variables are set", async () => {
    await withEnv(OLD_OVERRIDES, async () => {
      const response = await betaDownloadRoute.POST(post("/api/beta-download", { email: "pinned-build@example.com" }));
      assert.equal(response.status, 200);
      const body = (await response.json()) as { downloadUrl?: string };
      assert.equal(body.downloadUrl, BETA_MAC_DOWNLOAD_URL);
    });
  });

  it("emails this release's Mac build under a send key that names the release", async () => {
    // Capture what would go to Resend. Only the fake Supabase is reachable; any other host fails the test.
    const emails: { key: string | null; html: string; text: string }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://api.resend.com/emails") {
        const body = JSON.parse(String(init?.body)) as { html: string; text: string };
        emails.push({ key: new Headers(init?.headers).get("idempotency-key"), html: body.html, text: body.text });
        return Response.json({ id: `email-${emails.length}` });
      }
      if (process.env.SUPABASE_URL && url.startsWith(process.env.SUPABASE_URL)) return realFetch(input, init);
      throw new Error(`unexpected network call from the test: ${url}`);
    }) as typeof fetch;
    try {
      await withEnv({ ...OLD_OVERRIDES, RESEND_API_KEY: "resend-test-key" }, async () => {
        // A fresh address each run: the local download store (.data) remembers who was already emailed.
        const response = await betaDownloadRoute.POST(post("/api/beta-download", { email: `pinned-email-${randomUUID()}@example.com` }));
        assert.equal(response.status, 200);
        const welcome = emails.find((sent) => sent.key?.startsWith("unvibe-welcome-"));
        assert.ok(welcome, "the welcome email was sent");
        assert.ok(welcome.html.includes(BETA_MAC_DOWNLOAD_URL), "the HTML email links the pinned build");
        assert.ok(welcome.text.includes(BETA_MAC_DOWNLOAD_URL), "the text email links the pinned build");
        assert.ok(!`${welcome.html}${welcome.text}`.includes("example.com/old-"), "no override URL in the email");
        assert.ok(welcome.key?.startsWith(`unvibe-welcome-${BETA_INSTALL_TAG.replace(/^v/, "")}-`), `send key names the release: ${welcome.key}`);
      });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("beta-download: the setup tip email is its own opt-in", () => {
  /** Posts a download request and returns what would go to Resend. Only the fake Supabase is reachable. */
  async function sentEmails(body: Record<string, unknown>): Promise<{ key: string | null; text: string; scheduledAt?: string }[]> {
    const emails: { key: string | null; text: string; scheduledAt?: string }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://api.resend.com/emails") {
        const sent = JSON.parse(String(init?.body)) as { text: string; scheduled_at?: string };
        emails.push({ key: new Headers(init?.headers).get("idempotency-key"), text: sent.text, scheduledAt: sent.scheduled_at });
        return Response.json({ id: `email-${emails.length}` });
      }
      if (process.env.SUPABASE_URL && url.startsWith(process.env.SUPABASE_URL)) return realFetch(input, init);
      throw new Error(`unexpected network call from the test: ${url}`);
    }) as typeof fetch;
    try {
      await withEnv({ RESEND_API_KEY: "resend-test-key" }, async () => {
        // A fresh address each run: the local download store (.data) remembers who was already emailed.
        const response = await betaDownloadRoute.POST(post("/api/beta-download", { email: `setup-tip-${randomUUID()}@example.com`, ...body }));
        assert.equal(response.status, 200);
      });
    } finally {
      globalThis.fetch = realFetch;
    }
    return emails;
  }

  for (const [label, body] of [
    ["no reminder field", {}],
    ["reminder: false", { reminder: false }],
    ['reminder: "true" (a string)', { reminder: "true" }],
    ["reminder: 1", { reminder: 1 }],
  ] as const) {
    it(`schedules no setup tip with ${label}, and the welcome email doesn't promise one`, async () => {
      const emails = await sentEmails(body);
      assert.deepEqual(emails.filter((sent) => sent.key?.startsWith("unvibe-setup-reminder-")), [], "no setup tip scheduled");
      assert.ok(emails.every((sent) => !sent.scheduledAt), "nothing scheduled for later");
      const welcome = emails.find((sent) => sent.key?.startsWith("unvibe-welcome-"));
      assert.ok(welcome, "the welcome email was still sent");
      assert.ok(!welcome.text.includes("setup tip"), "the welcome email doesn't mention a setup tip");
    });
  }

  it("schedules the setup tip for tomorrow only with reminder: true", async () => {
    const emails = await sentEmails({ reminder: true });
    const tips = emails.filter((sent) => sent.key?.startsWith("unvibe-setup-reminder-"));
    assert.equal(tips.length, 1, "one setup tip scheduled");
    assert.equal(tips[0]!.scheduledAt, "in 1 day");
    const welcome = emails.find((sent) => sent.key?.startsWith("unvibe-welcome-"));
    assert.ok(welcome?.text.includes("one setup tip tomorrow"), "the welcome email says the tip follows");
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

describe("a waitlist signup is counted in analytics only when the browser allowed it (Security U-L1)", () => {
  async function signUp(extra: Record<string, unknown>): Promise<number> {
    const local = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return withEnv(
      { MIXPANEL_TOKEN: "mp_test", MIXPANEL_HOST: local },
      async () => (await waitlistRoute.POST(post("/api/waitlist", { email: `consent-${randomUUID().slice(0, 8)}@unvibe-mail.test`, ...extra }))).status,
    );
  }

  for (const [name, extra] of [
    ["no answer sent", {}],
    ["analytics false", { analytics: false }],
    ["the string \"true\"", { analytics: "true" }],
    ["the number 1", { analytics: 1 }],
  ] as const) {
    it(`${name}: the signup is saved and nothing goes to Mixpanel or the funnel`, async () => {
      analyticsHits.length = 0;
      funnelHits = 0;
      assert.equal(await signUp(extra), 200);
      assert.deepEqual(analyticsHits, []);
      assert.equal(funnelHits, 0);
    });
  }

  it("analytics true: one Mixpanel event, and the funnel counts it", async () => {
    analyticsHits.length = 0;
    funnelHits = 0;
    assert.equal(await signUp({ analytics: true }), 200);
    assert.deepEqual(analyticsHits, ["/track"]);
    assert.ok(funnelHits > 0);
  });
});

describe("newsletter signups need the consent box and send no email (ledger 299)", () => {
  const newsletterEmail = () => `news-${randomUUID().slice(0, 8)}@unvibe-mail.test`;

  /** Posts to /api/waitlist with Resend configured and returns the response plus every address Resend was asked to mail. */
  async function signUp(body: Record<string, unknown>): Promise<{ response: Response; mailedTo: string[] }> {
    const mailedTo: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://api.resend.com/emails") {
        const sent: unknown = JSON.parse(String(init?.body));
        if (sent && typeof sent === "object" && "to" in sent && Array.isArray(sent.to)) mailedTo.push(...sent.to.map(String));
        return Response.json({ id: `email-${mailedTo.length}` });
      }
      if (process.env.SUPABASE_URL && url.startsWith(process.env.SUPABASE_URL)) return realFetch(input, init);
      throw new Error(`unexpected network call from the test: ${url}`);
    }) as typeof fetch;
    try {
      const response = await withEnv({ RESEND_API_KEY: "resend-test-key" }, () => waitlistRoute.POST(post("/api/waitlist", body)));
      return { response, mailedTo };
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  for (const [label, extra] of [
    ["no consent field", {}],
    ["consent: false", { consent: false }],
    ['consent: "true" (a string)', { consent: "true" }],
    ["consent: 1", { consent: 1 }],
  ] as const) {
    it(`refuses a newsletter post with ${label} (422) and stores nothing`, async () => {
      const email = newsletterEmail();
      const { response, mailedTo } = await signUp({ email, source: "newsletter", ...extra });
      assert.equal(response.status, 422);
      const answer: unknown = await response.json();
      assert.ok(answer && typeof answer === "object" && "issues" in answer && answer.issues && typeof answer.issues === "object" && "consent" in answer.issues);
      assert.equal(waitlistRows.has(email), false);
      assert.deepEqual(mailedTo, []);
    });
  }

  it("stores a consented signup with the source, the consent version and the time", async () => {
    const email = newsletterEmail();
    const before = Date.now();
    const { response } = await signUp({ email, source: "newsletter", consent: true });
    assert.equal(response.status, 200);
    const row = waitlistRows.get(email);
    assert.ok(row, "the entry is stored");
    assert.equal(row.newsletter_consent_source, "newsletter");
    assert.equal(row.newsletter_consent_version, NEWSLETTER_CONSENT_VERSION);
    const at = Date.parse(String(row.newsletter_consent_at));
    assert.ok(at >= before && at <= Date.now(), "consent time is the signup time");
  });

  it("sends the subscriber no welcome email (a waitlist signup still gets one)", async () => {
    const newsletter = newsletterEmail();
    const subscribed = await signUp({ email: newsletter, source: "newsletter", consent: true });
    assert.equal(subscribed.response.status, 200);
    assert.equal(subscribed.mailedTo.includes(newsletter), false, "nothing mailed to the subscriber");
    assert.equal(waitlistRows.get(newsletter)?.beta_email_status, undefined, "no welcome email attempt recorded");

    const waitlister = newsletterEmail();
    const joined = await signUp({ email: waitlister });
    assert.equal(joined.response.status, 200);
    assert.ok(joined.mailedTo.includes(waitlister), "the harness does see a welcome email");
    assert.equal(waitlistRows.get(waitlister)?.newsletter_consent_at, undefined, "a waitlist signup records no newsletter consent");
  });

  it("records consent for an email already on the waitlist and answers exactly as for a new one", async () => {
    const email = newsletterEmail();
    const first = await signUp({ email });
    assert.equal(waitlistRows.get(email)?.newsletter_consent_at, undefined);
    const again = await signUp({ email, source: "newsletter", consent: true });
    assert.equal(again.response.status, first.response.status);
    assert.deepEqual(await again.response.json(), await first.response.json());
    assert.deepEqual(again.mailedTo, [], "no second email of any kind");
    const row = waitlistRows.get(email);
    assert.equal(row?.newsletter_consent_source, "newsletter");
    assert.equal(row?.newsletter_consent_version, NEWSLETTER_CONSENT_VERSION);
    assert.ok(row?.newsletter_consent_at);
  });

  it("a second newsletter post keeps the first consent and the entry stays out of beta invites (Security R-1)", async () => {
    const email = newsletterEmail();
    await signUp({ email, source: "newsletter", consent: true });
    const row = waitlistRows.get(email);
    assert.ok(row);
    // An earlier first consent, so a rewrite by the second post would show.
    const firstAt = "2026-10-01T00:00:00.000Z";
    row.newsletter_consent_at = firstAt;
    const again = await signUp({ email, source: "newsletter", consent: true });
    assert.equal(again.response.status, 200);
    assert.equal(row.signup_source, "newsletter");
    assert.equal(row.newsletter_consent_at, firstAt, "the first consent time stands");
    const listed = (await listWaitlistEntries(10_000)).filter((entry) => entry.email === email);
    assert.equal(listed.length, 1);
    assert.deepEqual(betaInviteCandidates(listed), []);
  });

  it("a waitlist signup that later ticks the newsletter box stays a beta invite candidate", async () => {
    const email = newsletterEmail();
    await signUp({ email });
    await signUp({ email, source: "newsletter", consent: true });
    const row = waitlistRows.get(email);
    assert.equal(row?.signup_source, undefined, "a duplicate never writes signup_source");
    assert.ok(row?.newsletter_consent_at, "the consent is recorded");
    const listed = (await listWaitlistEntries(10_000)).filter((entry) => entry.email === email);
    assert.deepEqual(betaInviteCandidates(listed).map((entry) => entry.email), [email]);
  });
});
