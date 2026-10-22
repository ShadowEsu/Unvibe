import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchPaymentsOpen, PAYMENTS_STATUS_REVALIDATE_SECONDS } from "./paymentsStatus";

type Call = { url: string; init?: RequestInit };

function fakeFetch(respond: (call: Call) => Promise<Response> | Response) {
  const calls: Call[] = [];
  const impl = ((url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    return Promise.resolve().then(() => respond(call));
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("payments status (site copy may only promise checkout when the API says it is open)", () => {
  afterEach(() => {
    delete process.env.UNVIBE_APP_BACKEND_URL;
  });

  it("is open only when the API answers paymentsOpen: true", async () => {
    const { impl, calls } = fakeFetch(() => json({ paymentsOpen: true }));
    assert.equal(await fetchPaymentsOpen(impl), true);
    assert.equal(calls[0].url, "https://api.unvibe.site/api/v1/billing/status");
    assert.equal(calls[0].init?.next?.revalidate, PAYMENTS_STATUS_REVALIDATE_SECONDS);
    assert.ok(calls[0].init?.signal, "the request has a timeout");
  });

  it("uses the configured API origin", async () => {
    process.env.UNVIBE_APP_BACKEND_URL = "https://api.example.test/ignored/path";
    const { impl, calls } = fakeFetch(() => json({ paymentsOpen: true }));
    await fetchPaymentsOpen(impl);
    assert.equal(calls[0].url, "https://api.example.test/api/v1/billing/status");
  });

  it("is closed when the API says closed", async () => {
    assert.equal(await fetchPaymentsOpen(fakeFetch(() => json({ paymentsOpen: false })).impl), false);
  });

  it("fails closed when the request throws", async () => {
    assert.equal(await fetchPaymentsOpen(fakeFetch(() => { throw new TypeError("fetch failed"); }).impl), false);
  });

  it("fails closed on a non-2xx answer, even one that claims open", async () => {
    assert.equal(await fetchPaymentsOpen(fakeFetch(() => json({ paymentsOpen: true }, 503)).impl), false);
    assert.equal(await fetchPaymentsOpen(fakeFetch(() => json({ paymentsOpen: true }, 404)).impl), false);
  });

  it("fails closed on a body that is not exactly paymentsOpen: true", async () => {
    for (const body of [{ paymentsOpen: "true" }, { paymentsOpen: 1 }, {}, null, [true], "open"]) {
      assert.equal(await fetchPaymentsOpen(fakeFetch(() => json(body)).impl), false, JSON.stringify(body));
    }
    const html = new Response("<!doctype html><title>502</title>", { status: 200, headers: { "content-type": "text/html" } });
    assert.equal(await fetchPaymentsOpen(fakeFetch(() => html).impl), false);
  });

  it("fails closed when the API is slower than the timeout", async () => {
    const hang = fakeFetch(({ init }) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const started = Date.now();
    assert.equal(await fetchPaymentsOpen(hang.impl, 30), false);
    assert.ok(Date.now() - started < 2_000, "gives up at the timeout");
  });

  it("fails closed when the configured API origin is unusable", async () => {
    process.env.UNVIBE_APP_BACKEND_URL = "not a url";
    const { impl, calls } = fakeFetch(() => json({ paymentsOpen: true }));
    assert.equal(await fetchPaymentsOpen(impl), false);
    assert.equal(calls.length, 0);
  });
});
