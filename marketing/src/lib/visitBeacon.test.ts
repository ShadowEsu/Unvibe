import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_CONSENT_KEY, analyticsConsentRecord, storeAnalyticsConsent } from "./analyticsConsent";
import { startVisitBeacon } from "./visitBeacon";

const realWindow: unknown = Reflect.get(globalThis, "window");
const realFetch = globalThis.fetch;
let beacons: string[] = [];

/** A browser tab: its own storage, GPC flag, address and consent events. */
function tab({ stored, gpc = false, path = "/", search = "" }: { stored?: "allow" | "deny"; gpc?: boolean; path?: string; search?: string }) {
  const items = new Map<string, string>();
  if (stored) items.set(ANALYTICS_CONSENT_KEY, analyticsConsentRecord(stored, new Date()));
  const events = new EventTarget();
  Reflect.set(globalThis, "window", Object.assign(events, {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    },
    navigator: { webdriver: false, globalPrivacyControl: gpc },
    location: { pathname: path, search },
  }));
  beacons = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    beacons.push(String(input));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
}

afterEach(() => {
  Reflect.set(globalThis, "window", realWindow);
  globalThis.fetch = realFetch;
});

describe("the visit beacon waits for Allow (Security A4)", () => {
  it("sends nothing before an answer, and nothing after No thanks", () => {
    tab({});
    const stop = startVisitBeacon();
    assert.deepEqual(beacons, []);
    storeAnalyticsConsent("deny");
    assert.deepEqual(beacons, []);
    stop();
  });

  it("sends once when Allow is pressed on this page, and only once", () => {
    tab({});
    const stop = startVisitBeacon();
    storeAnalyticsConsent("allow");
    storeAnalyticsConsent("allow");
    assert.deepEqual(beacons, ["/api/stats/hit"]);
    stop();
  });

  it("sends at load when Allow was stored earlier", () => {
    tab({ stored: "allow" });
    startVisitBeacon()();
    assert.deepEqual(beacons, ["/api/stats/hit"]);
  });

  it("sends nothing with Global Privacy Control, ?notrack=1 or on a private page, even after Allow", () => {
    for (const visit of [{ gpc: true }, { search: "?notrack=1" }, { path: "/founder" }, { path: "/stats" }]) {
      tab({ stored: "allow", ...visit });
      startVisitBeacon()();
      assert.deepEqual(beacons, [], JSON.stringify(visit));
    }
  });
});
