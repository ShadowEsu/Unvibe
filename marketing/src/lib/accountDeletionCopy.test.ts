import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The API's second-Blob-failure answer (web/app/api/v1/account/route.ts CLEANUP_PENDING) promises
// 30 days; both public pages must say the same. Source text, whitespace collapsed (JSX wraps lines).
const COMMITMENT =
  "if we cannot check for beta-download records at the time, any we find, and the email address kept to find them, are removed within 30 days.";

function pageText(route: string): string {
  return readFileSync(join(process.cwd(), "src", "app", route, "page.tsx"), "utf8").replace(/\s+/g, " ");
}

describe("account deletion copy", () => {
  it("states the 30-day beta-download commitment on /account-deletion and /privacy", () => {
    assert.ok(pageText("account-deletion").includes(`If ${COMMITMENT.slice(3)}`));
    assert.ok(pageText("privacy").includes(`Deletion runs at once; ${COMMITMENT}`));
  });
});
