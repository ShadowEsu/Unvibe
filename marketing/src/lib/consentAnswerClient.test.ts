import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { sendConsentAnswer } from "@/lib/consentAnswerClient";
import { NOTRACK_STORAGE_KEY } from "@/lib/trackingOptOut";

function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("consent answer request (Security C-1, C-2)", () => {
  const realWindow: unknown = Reflect.get(globalThis, "window");
  const realFetch = globalThis.fetch;
  let calls: Array<{ url: string; init: RequestInit | undefined }> = [];

  function installWindow(webdriver: boolean, search: string, store = storage()) {
    Reflect.set(globalThis, "window", {
      navigator: { webdriver },
      location: { href: `https://unvibe.site/${search}`, pathname: "/", search },
      localStorage: store,
    });
  }

  beforeEach(() => {
    calls = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
  });

  afterEach(() => {
    Reflect.set(globalThis, "window", realWindow);
    globalThis.fetch = realFetch;
  });

  it("sends only the answer, with no cookie and no referrer", () => {
    installWindow(false, "");
    sendConsentAnswer("deny");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/consent/answer");
    assert.deepEqual(calls[0]!.init, {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: '{"answer":"deny"}',
    });
  });

  it("sends nothing from an automated browser or one that opted out with ?notrack", () => {
    installWindow(true, "");
    sendConsentAnswer("allow");
    installWindow(false, "?notrack=1");
    sendConsentAnswer("allow");
    installWindow(false, "", storage({ [NOTRACK_STORAGE_KEY]: "1" }));
    sendConsentAnswer("deny");
    assert.equal(calls.length, 0);
  });
});
