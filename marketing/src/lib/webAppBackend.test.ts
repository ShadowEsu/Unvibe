import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serviceErrorJson } from "./webAppBackend";

describe("a failed answer from the Unvibe service, on unvibe.site", () => {
  it("keeps the service's own message and status", async () => {
    const res = await serviceErrorJson(Response.json({ error: "You have used today's explanations." }, { status: 429 }));
    assert.equal(res.status, 429);
    assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
    assert.deepEqual(await res.json(), { error: "You have used today's explanations." });
  });

  it("never passes an HTML body or its content type through", async () => {
    const html = new Response("<html><script>alert(1)</script></html>", { status: 502, headers: { "content-type": "text/html" } });
    const res = await serviceErrorJson(html);
    assert.equal(res.status, 502);
    assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error.includes("<"), false);
  });

  it("drops a non-string or overlong error and answers 502 for a 200 with no body", async () => {
    const odd = await serviceErrorJson(Response.json({ error: { html: "<b>x</b>" } }, { status: 500 }));
    assert.equal(((await odd.json()) as { error: string }).error.includes("<"), false);
    const long = await serviceErrorJson(Response.json({ error: "x".repeat(301) }, { status: 400 }));
    assert.equal(((await long.json()) as { error: string }).error.length < 301, true);
    const empty = await serviceErrorJson(new Response(null, { status: 200 }));
    assert.equal(empty.status, 502);
  });
});
