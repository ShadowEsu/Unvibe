import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeReleases } from "./downloadStats";


test("installer totals exclude update archives and checksums", () => {
  const stats = summarizeReleases([
    { tag_name: "v2", published_at: "2026-09-01", assets: [
      { name: "a.dmg", download_count: 32 },
      { name: "a.dmg.sha256", download_count: 900 },
      { name: "a.exe", download_count: 55 },
      { name: "a.zip", download_count: 100 },
    ] },
    { tag_name: "v1", published_at: "2026-08-01", assets: [{ name: "b.dmg", download_count: 10 }] },
  ], "v2");
  assert.equal(stats.total, 97);
  assert.equal(stats.mac, 42);
  assert.equal(stats.windows, 55);
  assert.equal(stats.currentMac, 32);
  assert.equal(stats.currentWindows, 55);
});
