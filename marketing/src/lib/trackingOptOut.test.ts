import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordBetaSiteEvent, track } from "./analytics";
import { NOTRACK_STORAGE_KEY, trackingDisabled, type OptOutStorage } from "./trackingOptOut";

type FakeStorage = OptOutStorage & { data: Map<string, string> };

function fakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const throwingStorage: OptOutStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("SecurityError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
};

describe("trackingDisabled", () => {
  it("is off for a normal visitor", () => {
    assert.equal(trackingDisabled({ webdriver: false, search: "?utm_source=x", storage: fakeStorage() }), false);
  });

  it("is on for automated browsers (Playwright and other WebDriver clients)", () => {
    assert.equal(trackingDisabled({ webdriver: true, search: "", storage: fakeStorage() }), true);
  });

  it("?notrack=1 opts this browser out, and the opt-out survives later visits without the parameter", () => {
    const storage = fakeStorage();
    assert.equal(trackingDisabled({ webdriver: false, search: "?notrack=1", storage }), true);
    assert.equal(storage.data.get(NOTRACK_STORAGE_KEY), "1");
    assert.equal(trackingDisabled({ webdriver: false, search: "", storage }), true);
  });

  it("?notrack=0 clears a stored opt-out", () => {
    const storage = fakeStorage({ [NOTRACK_STORAGE_KEY]: "1" });
    assert.equal(trackingDisabled({ webdriver: false, search: "?a=b&notrack=0", storage }), false);
    assert.equal(storage.data.has(NOTRACK_STORAGE_KEY), false);
    assert.equal(trackingDisabled({ webdriver: false, search: "", storage }), false);
  });

  it("ignores other notrack values", () => {
    const storage = fakeStorage();
    assert.equal(trackingDisabled({ webdriver: false, search: "?notrack=yes", storage }), false);
    assert.equal(storage.data.size, 0);
  });

  it("still honours ?notrack=1 for the current page when storage is blocked", () => {
    assert.equal(trackingDisabled({ webdriver: false, search: "?notrack=1", storage: throwingStorage }), true);
    assert.equal(trackingDisabled({ webdriver: false, search: "", storage: throwingStorage }), false);
  });
});

describe("analytics respects the opt-out", () => {
  const realWindow: unknown = Reflect.get(globalThis, "window");
  const realFetch = globalThis.fetch;
  let calls: string[] = [];

  function installWindow(webdriver: boolean, search: string, storage: OptOutStorage = fakeStorage()) {
    Reflect.set(globalThis, "window", {
      navigator: { webdriver },
      location: { href: `https://unvibe.site/${search}`, pathname: "/", search },
      localStorage: storage,
    });
  }

  beforeEach(() => {
    calls = [];
    const recordingFetch: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(null, { status: 204 });
    };
    globalThis.fetch = recordingFetch;
  });

  afterEach(() => {
    Reflect.set(globalThis, "window", realWindow);
    globalThis.fetch = realFetch;
  });

  it("sends a funnel event for a normal visitor", () => {
    installWindow(false, "");
    track("waitlist_completed");
    assert.ok(calls.length > 0, "expected at least one analytics request");
  });

  it("sends nothing from an automated browser", () => {
    installWindow(true, "");
    track("waitlist_completed");
    recordBetaSiteEvent("copied");
    assert.deepEqual(calls, []);
  });

  it("sends nothing after ?notrack=1, including on later pages", () => {
    const storage = fakeStorage();
    installWindow(false, "?notrack=1", storage);
    track("waitlist_completed");
    installWindow(false, "", storage);
    track("beta_install_copied");
    recordBetaSiteEvent("survey");
    assert.deepEqual(calls, []);
  });
});
