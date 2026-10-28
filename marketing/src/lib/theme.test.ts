import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { BOOT_SCRIPT } from "./theme";

/** Runs the boot script against a visitor whose system is dark and who once picked dark on the old toggle. */
function bootDarkVisitor(stored: Record<string, string>) {
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
  const window = { localStorage, matchMedia };
  runInNewContext(BOOT_SCRIPT, { document: { documentElement: html }, window, localStorage, matchMedia });
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
});
