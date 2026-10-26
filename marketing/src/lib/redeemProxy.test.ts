import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { POST } from "../app/api/redeem/route";

/**
 * /api/redeem against a fake API (node:http), with the limiter in its local-development memory
 * mode (no Supabase env): only the token and the code are forwarded, the API's answer passes
 * through, and foreign origins, bursts and a down API are handled.
 */

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;

interface Forwarded { path: string; body: unknown }
const forwarded: Forwarded[] = [];
let answer: { status: number; body: unknown } = { status: 200, body: {} };
let server: Server;

before(async () => {
  server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += chunk;
    forwarded.push({ path: request.url ?? "", body: JSON.parse(text) });
    response.writeHead(answer.status, { "Content-Type": "application/json" }).end(JSON.stringify(answer.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fake API did not bind a port");
  process.env.UNVIBE_APP_BACKEND_URL = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

let ipCounter = 0;
function post(body: unknown, headers: Record<string, string> = {}, ip?: string): Promise<Response> {
  ipCounter += 1;
  return POST(new Request("http://localhost:3000/api/redeem", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json", "x-forwarded-for": ip ?? `10.3.0.${ipCounter}`, ...headers },
    body: JSON.stringify(body),
  }));
}

describe("/api/redeem proxy", () => {
  it("forwards only the access token and the code, and passes the API's answer through", async () => {
    forwarded.length = 0;
    answer = { status: 200, body: { ok: true, status: "redeemed", months: 3, proUntil: "2027-01-24T20:00:00.000Z" } };
    const res = await post({ accessToken: "tok", code: "ABCD-EFGH-JKMN-PQRS", email: "x@y.z", userId: "someone-else" });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.deepEqual(await res.json(), answer.body);
    assert.deepEqual(forwarded, [{ path: "/api/v1/promo/redeem", body: { accessToken: "tok", code: "ABCD-EFGH-JKMN-PQRS" } }]);
  });

  it("keeps the API's status codes", async () => {
    for (const status of [400, 401, 404, 409, 410, 429, 503]) {
      answer = { status, body: { ok: false, error: "x" } };
      assert.equal((await post({ accessToken: "tok", code: "ABCD-EFGH-JKMN-PQRS" })).status, status);
    }
  });

  it("refuses posts from other sites and non-JSON bodies before calling the API", async () => {
    forwarded.length = 0;
    assert.equal((await post({ accessToken: "tok", code: "c" }, { origin: "https://evil.example" })).status, 403);
    assert.equal((await post({ accessToken: "tok", code: "c" }, { "content-type": "text/plain" })).status, 415);
    assert.equal(forwarded.length, 0);
  });

  it("limits one network to 60 tries a minute in the shared limiter", async () => {
    answer = { status: 404, body: { ok: false, error: "invalid" } };
    for (let i = 0; i < 60; i += 1) assert.equal((await post({ accessToken: "tok", code: "ABCD-EFGH-JKMN-PQRS" }, {}, "10.4.4.4")).status, 404);
    forwarded.length = 0;
    assert.equal((await post({ accessToken: "tok", code: "ABCD-EFGH-JKMN-PQRS" }, {}, "10.4.4.4")).status, 429);
    assert.equal(forwarded.length, 0);
    assert.equal((await post({ accessToken: "tok", code: "ABCD-EFGH-JKMN-PQRS" }, {}, "10.4.4.5")).status, 404);
  });

  it("answers 503 when the API cannot be reached", async () => {
    const saved = process.env.UNVIBE_APP_BACKEND_URL;
    process.env.UNVIBE_APP_BACKEND_URL = "http://127.0.0.1:9";
    try {
      const res = await post({ accessToken: "tok", code: "ABCD-EFGH-JKMN-PQRS" });
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: "unavailable" });
    } finally {
      process.env.UNVIBE_APP_BACKEND_URL = saved;
    }
  });
});
