import assert from "node:assert/strict";
import { test } from "node:test";
import { platformOf, summarizeReleases } from "./downloadStats";

test("platformOf ignores checksums and maps installers", () => {
  assert.equal(platformOf("Unvibe-0.1.11-beta-arm64-unsigned.dmg"), "mac");
  assert.equal(platformOf("Unvibe-0.1.10-usage-meters-arm64.zip"), "mac");
  assert.equal(platformOf("Unvibe-0.1.11-win-x64-portable.exe"), "windows");
  assert.equal(platformOf("Unvibe-0.1.11-beta-arm64-unsigned.dmg.sha256"), null);
  assert.equal(platformOf("install-unvibe-beta.sh"), null);
});

test("summarizeReleases totals by platform and picks the current tag", () => {
  const stats = summarizeReleases([
    { tag_name: "v2", published_at: "2026-09-01", assets: [
      { name: "a.dmg", download_count: 32 },
      { name: "a.dmg.sha256", download_count: 900 },
      { name: "a.exe", download_count: 55 },
    ] },
    { tag_name: "v1", published_at: "2026-08-01", assets: [{ name: "b.zip", download_count: 10 }] },
    { tag_name: "v0", published_at: "2026-07-01", assets: [{ name: "c.sha256", download_count: 3 }] },
  ], "v2");
  assert.equal(stats.total, 97);
  assert.equal(stats.mac, 42);
  assert.equal(stats.windows, 55);
  assert.equal(stats.currentMac, 32);
  assert.equal(stats.currentWindows, 55);
  assert.equal(stats.releases.length, 2);
});
