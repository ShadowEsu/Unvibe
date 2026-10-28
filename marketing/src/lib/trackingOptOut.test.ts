// First import: unsets the analytics keys before analytics.ts reads them at load.
import { ANALYTICS_KEYS, restoreAnalyticsKeys } from "./testWithoutAnalyticsKeys";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyticsEnabled, recordBetaSiteEvent, setAnalyticsConsent, track } from "./analytics";
import { ANALYTICS_CONSENT_KEY, analyticsConsentRecord } from "./analyticsConsent";
import { NOTRACK_STORAGE_KEY, trackingDisabled, type OptOutStorage } from "./trackingOptOut";

after(restoreAnalyticsKeys);

it("loads analytics with every analytics key unset, so nothing real is sent and no vendor SDK starts", () => {
  for (const name of ANALYTICS_KEYS) assert.equal(process.env[name], undefined, `${name} is unset during these tests`);
  assert.equal(analyticsEnabled, false, "analytics.ts loaded with no key");
});

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
  const allowed = () => fakeStorage({ [ANALYTICS_CONSENT_KEY]: analyticsConsentRecord("allow", new Date("2026-10-28T09:00:00Z")) });

  function installWindow(webdriver: boolean, search: string, storage: OptOutStorage = allowed(), globalPrivacyControl?: boolean) {
    Reflect.set(globalThis, "window", {
      navigator: { webdriver, globalPrivacyControl },
      location: { href: `https://unvibe.site/${search}`, pathname: "/", search },
      localStorage: storage,
      dispatchEvent: () => true,
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

  it("sends a funnel event for a visitor who allowed analytics", () => {
    installWindow(false, "");
    track("waitlist_completed");
    assert.ok(calls.length > 0, "expected at least one analytics request");
  });

  it("sends nothing before the visitor answers the analytics bar", () => {
    installWindow(false, "", fakeStorage());
    track("waitlist_completed");
    recordBetaSiteEvent("copied");
    assert.deepEqual(calls, []);
  });

  it("sends nothing with Global Privacy Control, even after Allow", () => {
    installWindow(false, "", allowed(), true);
    track("waitlist_completed");
    recordBetaSiteEvent("copied");
    assert.deepEqual(calls, []);
  });

  it("Allow starts sending, No thanks stops it at once, and the answer is stored", () => {
    const storage = fakeStorage();
    installWindow(false, "", storage);
    setAnalyticsConsent("allow");
    assert.equal(JSON.parse(storage.data.get(ANALYTICS_CONSENT_KEY) ?? "{}").choice, "allow");
    track("waitlist_completed");
    assert.ok(calls.length > 0, "sends after Allow");
    calls = [];
    setAnalyticsConsent("deny");
    assert.equal(JSON.parse(storage.data.get(ANALYTICS_CONSENT_KEY) ?? "{}").choice, "deny");
    track("waitlist_completed");
    recordBetaSiteEvent("copied");
    assert.deepEqual(calls, [], "nothing after No thanks");
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
