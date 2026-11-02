import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { BOOT_SCRIPT } from "./theme";
import { ANALYTICS_CONSENT_KEY, ANALYTICS_POLICY_VERSION, readAnalyticsConsent } from "./analyticsConsent";

/** Runs the boot script against a visitor whose system is dark and who once picked dark on the old toggle. */
function bootDarkVisitor(stored: Record<string, string>, navigator: Record<string, unknown> = {}) {
  const classes = new Set<string>();
  const storage = new Map(Object.entries(stored));
  const html = {
    classList: {
      add: (...names: string[]) => names.forEach((n) => classes.add(n)),
      remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
      contains: (n: string) => classes.has(n),
      toggle: (n: string, force?: boolean) => {
        const on = force ?? !classes.has(n);
        if (on) classes.add(n);
        else classes.delete(n);
        return on;
      },
    },
    style: { colorScheme: "" },
  };
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
    clear: () => storage.clear(),
    key: (i: number) => Array.from(storage.keys())[i] ?? null,
    get length() {
      return storage.size;
    },
  };
  const matchMedia = (query: string) => ({ matches: query.includes("dark"), media: query });
  const window = { localStorage, matchMedia, navigator };
  runInNewContext(BOOT_SCRIPT, { document: { documentElement: html }, window, localStorage, matchMedia, navigator });
  return { classes, colorScheme: html.style.colorScheme, storage };
}

describe("BOOT_SCRIPT", () => {
  it("renders light for a dark-system visitor who stored the old dark choice", () => {
    const { classes, colorScheme } = bootDarkVisitor({ "unvibe-theme": "dark" });
    assert.equal(classes.has("dark"), false);
    assert.equal(colorScheme, "light");
  });

  it("adds the js class the motion start states depend on", () => {
    assert.equal(bootDarkVisitor({}).classes.has("js"), true);
  });

  it("keeps the analytics opt-out and every other stored key", () => {
    const { storage } = bootDarkVisitor({ "unvibe-theme": "dark", unvibe_notrack: "1", unvibe_anon_id: "anon-123" });
    assert.equal(storage.get("unvibe_notrack"), "1");
    assert.equal(storage.get("unvibe_anon_id"), "anon-123");
  });

  it("marks consent known exactly when the bar would not ask (same rule as readAnalyticsConsent)", () => {
    const record = (v: unknown, choice: unknown) => JSON.stringify({ v, choice, at: "2026-11-02T00:00:00.000Z" });
    const cases: Array<[string, string | null, boolean]> = [
      ["first visit", null, false],
      ["allow, this policy", record(ANALYTICS_POLICY_VERSION, "allow"), false],
      ["no thanks, this policy", record(ANALYTICS_POLICY_VERSION, "deny"), false],
      ["allow, older policy", record("2026-10-01", "allow"), false],
      ["unknown choice", record(ANALYTICS_POLICY_VERSION, "maybe"), false],
      ["not JSON", "allow", false],
      ["JSON null", "null", false],
      ["first visit with GPC", null, true],
      ["older policy with GPC", record("2026-10-01", "allow"), true],
      ["not JSON with GPC", "allow", true],
    ];
    for (const [label, stored, gpc] of cases) {
      const { classes } = bootDarkVisitor(stored === null ? {} : { [ANALYTICS_CONSENT_KEY]: stored }, gpc ? { globalPrivacyControl: true } : {});
      assert.equal(classes.has("consent-known"), readAnalyticsConsent(stored, gpc) !== "ask", label);
    }
  });

  it("when storage throws: still adds js, asks without GPC, never asks with GPC", () => {
    const boot = (navigator: Record<string, unknown>) => {
      const classes = new Set<string>();
      const html = { classList: { add: (n: string) => void classes.add(n) }, style: { colorScheme: "" } };
      const localStorage = { getItem: () => { throw new Error("blocked"); } };
      runInNewContext(BOOT_SCRIPT, { document: { documentElement: html }, window: { localStorage, navigator } });
      return classes;
    };
    const plain = boot({});
    assert.equal(plain.has("js"), true);
    assert.equal(plain.has("consent-known"), false, "a first-visit bar still shows when storage is blocked");
    assert.equal(boot({ globalPrivacyControl: true }).has("consent-known"), true, "a GPC browser with blocked storage is never asked");
  });
});
