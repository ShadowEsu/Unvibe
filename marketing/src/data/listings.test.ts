import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { listingBadges, listingLinks, pendingBacklinks } from "./listings";

/** Every directory the footer may link to. A new one is added here on purpose, never by accident (Security R-3). */
const ALLOWED_LISTING_ORIGINS = [
  "https://smolstartup.com",
  "https://www.producthunt.com",
  "https://launchkiwi.com",
  "https://devrove.com",
  "https://www.aitooldiscovery.com",
  "https://viberank.dev",
  "https://www.sideprojectors.com",
  "https://launchbuff.com",
  "https://toolindex.net",
  "https://tinylaunch.com",
  "https://www.uneed.best",
  "https://foundermag.co",
  "https://krispitech.com",
  "https://vibecoding.app",
];

const BADGE_LIMIT_BYTES = 50 * 1024;

describe("footer listings", () => {
  it("links only to allowlisted directory origins, over https", () => {
    for (const { name, href } of [...listingLinks, ...listingBadges]) {
      const url = new URL(href);
      assert.equal(url.protocol, "https:", name);
      assert.ok(ALLOWED_LISTING_ORIGINS.includes(url.origin), `${name}: ${url.origin} is not in the allowlist`);
    }
  });

  it("shows no directory where Unvibe isn't listed yet (Security R-4)", () => {
    const shown = listingLinks.map((link) => new URL(link.href).origin);
    for (const pending of pendingBacklinks) assert.equal(shown.includes(new URL(pending.href).origin), false, pending.name);
  });

  it(`keeps every badge file under ${BADGE_LIMIT_BYTES / 1024} KB (Security R-7)`, () => {
    const dir = path.resolve("public/badges");
    for (const file of readdirSync(dir)) {
      assert.ok(statSync(path.join(dir, file)).size < BADGE_LIMIT_BYTES, `public/badges/${file} is too big`);
    }
  });
});
