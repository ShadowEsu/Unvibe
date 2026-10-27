import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** The only file allowed to name the owner inbox: the internal signup-alert recipient, never shown to visitors. */
const ALERT_RECIPIENT_FILE = "src/lib/notifyWaitlist.ts";
const TEXT = /\.(?:tsx?|jsx?|mjs|css|html?|txt|md|json|xml|svg|webmanifest)$/;

function files(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { recursive: true })
    .map((entry) => join(dir, String(entry)))
    .filter((path) => TEXT.test(path) && !path.endsWith(".test.ts") && statSync(join(process.cwd(), path)).isFile());
}

describe("public contact", () => {
  it("names no personal inbox in site source, public files or user email", () => {
    const offenders = [...files("src"), ...files("public")]
      .filter((path) => path !== ALERT_RECIPIENT_FILE)
      .filter((path) => /preston@/i.test(readFileSync(join(process.cwd(), path), "utf8")));
    assert.deepEqual(offenders, []);
  });

  it("keeps the alert recipient out of anything a visitor or user receives", () => {
    const alert = readFileSync(join(process.cwd(), ALERT_RECIPIENT_FILE), "utf8");
    assert.doesNotMatch(alert, /reply_to:\s*["'`][^"'`]*preston@/i);
  });
});
