import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchReleases } from "./releases";

const realFetch = globalThis.fetch;

function release(tag: string, name: string | null, draft = false) {
  return { tag_name: tag, name, published_at: "2026-10-25T00:00:00Z", body: null, html_url: `https://github.com/ShadowEsu/Unvibe/releases/tag/${tag}`, prerelease: true, draft, assets: [] };
}

/** Serves the given GitHub Releases payload to fetchReleases. */
function serve(payload: unknown[]) {
  globalThis.fetch = (async () => Response.json(payload)) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fetchReleases", () => {
  it("keeps the public v* releases and older app-v* ones, and drops drafts and other tags", async () => {
    serve([
      release("v0.1.45", "0.1.45", true),
      release("v0.1.44", "0.1.44"),
      release("v0.1.4-feedback-rewards", "Unvibe 0.1.4 feedback and beta rewards"),
      release("app-v0.0.9", null),
      release("extension-1.2.0", "Extension 1.2.0"),
      release("vscode", "Not a version"),
    ]);
    const { releases, error } = await fetchReleases();
    assert.equal(error, null);
    assert.deepEqual(releases.map((r) => r.tagName), ["v0.1.44", "v0.1.4-feedback-rewards", "app-v0.0.9"]);
  });

  it("shows a bare version name or an app-v tag as v0.1.44, and keeps a written name", async () => {
    serve([
      release("v0.1.44", "0.1.44"),
      release("v1.0.0", "Unvibe v1.0.0"),
      release("app-v0.0.9", null),
      release("app-v0.0.8", "app-v0.0.8"),
      release("v0.1.13", "  "),
    ]);
    const { releases } = await fetchReleases();
    assert.deepEqual(releases.map((r) => r.name), ["v0.1.44", "Unvibe v1.0.0", "v0.0.9", "v0.0.8", "v0.1.13"]);
  });

  it("reports GitHub errors instead of inventing releases", async () => {
    globalThis.fetch = (async () => new Response("rate limited", { status: 403 })) as typeof fetch;
    assert.deepEqual(await fetchReleases(), { releases: [], error: "GitHub responded with 403" });
  });
});
