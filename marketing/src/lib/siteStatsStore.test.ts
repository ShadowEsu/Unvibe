import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSiteStats, recordSiteHit } from "./siteStatsStore";

const dataFile = path.join(process.cwd(), ".data", "site-stats.json");

describe("siteStatsStore", () => {
  it("counts views and unique visitors across day week and all time", async () => {
    const previousBlob = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    await fs.rm(dataFile, { force: true }).catch(() => undefined);

    try {
      await recordSiteHit("visitor-a");
      await recordSiteHit("visitor-a");
      await recordSiteHit("visitor-b");

      const stats = await getSiteStats();
      assert.equal(stats.today.views, 3);
      assert.equal(stats.today.visitors, 2);
      assert.equal(stats.week.views, 3);
      assert.equal(stats.week.visitors, 2);
      assert.equal(stats.allTime.views, 3);
      assert.equal(stats.allTime.visitors, 2);
    } finally {
      if (previousBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = previousBlob;
      await fs.rm(dataFile, { force: true }).catch(() => undefined);
    }
  });
});
