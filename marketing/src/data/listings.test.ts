import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { directoryLinks, listingBadges, listingLinks } from "./listings";

/** Every directory the footer or /listed-on may link to. A new one is added here on purpose, never by accident (Security R-3). */
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
  "https://strategic-flow-audit.replit.app",
  "https://dang.ai",
  "https://www.toolpilot.ai",
];

const BADGE_LIMIT_BYTES = 50 * 1024;

describe("footer listings", () => {
  it("links only to allowlisted directory origins, over https", () => {
    for (const { name, href } of [...listingLinks, ...listingBadges, ...directoryLinks]) {
      const url = new URL(href);
      assert.equal(url.protocol, "https:", name);
      assert.ok(ALLOWED_LISTING_ORIGINS.includes(url.origin), `${name}: ${url.origin} is not in the allowlist`);
    }
  });

  it(`keeps every badge file under ${BADGE_LIMIT_BYTES / 1024} KB (Security R-7)`, () => {
    const dir = path.resolve("public/badges");
    for (const file of readdirSync(dir)) {
      assert.ok(statSync(path.join(dir, file)).size < BADGE_LIMIT_BYTES, `public/badges/${file} is too big`);
    }
  });
});
