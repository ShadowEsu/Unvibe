import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { LISTINGS, listingBadges, listingLinks, submittedTo } from "./listings";

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
  "https://agentwork.tools",
  "https://www.comingup.io",
  "https://aitoolscapital.com",
  "https://aisotools.com",
  "https://aitoolboard.com",
  "https://github.com",
  "https://openupvote.com",
  "https://junkstartups.com",
  "https://www.showmysites.com",
  "https://thehackstack.com",
  "https://sideprojects.net",
  "https://www.tinystartups.com",
  "https://www.indiehackers.com",
  "https://devhunt.org",
  "https://daniellaunches.com",
  "https://startupfa.me",
  "https://turbo0.com",
  "https://dododirectory.com",
  "https://sumodir.com",
  "https://postmake.io",
  "https://nicklaunches.com",
  "https://www.aitoolsprime.com",
  "https://dang.ai",
  "https://www.toolpilot.ai",
  "https://awesome.tools",
];

const BADGE_DIR = path.resolve("public/badges");
const BADGE_LIMIT_BYTES = 50 * 1024;

describe("footer listings", () => {
  it("links only to allowlisted directory origins, over https", () => {
    for (const { name, href } of [...listingLinks, ...listingBadges, ...submittedTo]) {
      const url = new URL(href);
      assert.equal(url.protocol, "https:", name);
      assert.ok(ALLOWED_LISTING_ORIGINS.includes(url.origin), `${name}: ${url.origin} is not in the allowlist`);
    }
  });

  it("shows a badge only for a live listing, and names a pending site with no listing claim (Security B1)", () => {
    for (const { site, status, badges } of LISTINGS) {
      if (status === "pending") assert.equal(badges, undefined, `${site} is pending and has a badge`);
    }
    for (const { name } of submittedTo) assert.doesNotMatch(name, /featured|listed|as seen on/i, name);
  });

  it(`keeps every badge file under ${BADGE_LIMIT_BYTES / 1024} KB (Security R-7)`, () => {
    for (const file of readdirSync(BADGE_DIR)) {
      assert.ok(statSync(path.join(BADGE_DIR, file)).size < BADGE_LIMIT_BYTES, `public/badges/${file} is too big`);
    }
  });

  it("records every badge file in public/badges/BADGES.md with its sha256, and keeps no unused file (Security B2)", () => {
    const record = readFileSync(path.join(BADGE_DIR, "BADGES.md"), "utf8");
    const used = new Set(LISTINGS.flatMap(({ badges = [] }) => badges.map(({ src }) => path.basename(src))));
    for (const file of readdirSync(BADGE_DIR).filter((name) => name !== "BADGES.md")) {
      assert.ok(used.has(file), `public/badges/${file} is not a live listing's badge`);
      const sha256 = createHash("sha256").update(readFileSync(path.join(BADGE_DIR, file))).digest("hex");
      assert.ok(record.includes(`| \`${file}\` |`) && record.includes(sha256), `public/badges/${file} is not recorded in BADGES.md`);
    }
  });
});
