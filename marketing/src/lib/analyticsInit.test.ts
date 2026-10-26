// First import: unsets the analytics keys before analytics.ts reads them at load.
import { restoreAnalyticsKeys } from "./testWithoutAnalyticsKeys";
import { after, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { initMixpanel, initPosthog } from "./analytics";
import { POSTHOG_PRIVACY_CONFIG, mixpanelPrivacyConfig } from "./analyticsPrivacy";

after(restoreAnalyticsKeys);

describe("Mixpanel init", () => {
  const realWindow: unknown = Reflect.get(globalThis, "window");

  afterEach(() => {
    Reflect.set(globalThis, "window", realWindow);
  });

  it("sets the site's anonymous id as the distinct id without identify, which skips every hook", () => {
    const stored = new Map([["unvibe_anon_id", "anon-test-0001"]]);
    Reflect.set(globalThis, "window", {
      navigator: { webdriver: false },
      location: { href: "https://unvibe.site/?ref=TESTREF1234", pathname: "/", search: "?ref=TESTREF1234" },
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => void stored.set(key, value),
        removeItem: (key: string) => void stored.delete(key),
      },
    });
    const calls: string[] = [];
    const registered: Array<Record<string, unknown>> = [];
    const fake = {
      init: (token: string) => void calls.push(`init ${token}`),
      register: (props: Record<string, unknown>) => {
        calls.push("register");
        registered.push(props);
      },
      identify: () => void calls.push("identify"),
      track: () => void calls.push("track"),
    };
    initMixpanel(fake as unknown as Parameters<typeof initMixpanel>[0], "test-token");
    assert.ok(!calls.includes("identify"), "identify sends $identify and profile updates past before_send_events");
    assert.deepEqual(calls, ["init test-token", "register"]);
    assert.deepEqual(registered, [{ distinct_id: "anon-test-0001" }], "the distinct id is the site's anonymous id");
  });

  it("drops every profile and group update, which skip before_send_events", () => {
    const { hooks } = mixpanelPrivacyConfig();
    assert.equal(hooks.before_send_people(), null);
    assert.equal(hooks.before_send_groups(), null);
  });
});

describe("PostHog init", () => {
  it("passes every privacy option to posthog.init unchanged, with no feature-flag requests", () => {
    const inits: Array<{ token: string; config: Record<string, unknown> }> = [];
    const fake = {
      init: (token: string, config: Record<string, unknown>) => void inits.push({ token, config }),
      identify: () => undefined,
    };
    initPosthog(fake as unknown as Parameters<typeof initPosthog>[0], "phc_test");
    assert.equal(inits.length, 1);
    const { config } = inits[0];
    assert.equal(config.advanced_disable_feature_flags, true, "/flags sends the stored first landing URL with no hook");
    for (const [name, value] of Object.entries(POSTHOG_PRIVACY_CONFIG)) {
      assert.deepEqual(config[name], value, `posthog.init gets ${name} as configured`);
    }
  });
});
