import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getBetaInstallCounts,
  parseBetaInstallEvent,
  parseSiteInstallEvent,
  recordBetaInstallCopySource,
  recordBetaInstallEvent,
  summarizeCopySources,
} from "./betaInstallStats";
import { dayKey } from "./siteStatsStore";

const dataFile = path.join(process.cwd(), ".data", "beta-install.json");
const tmpDataFile = path.join("/tmp", "unvibe-beta-install", "beta-install.json");
const sourcesFiles = [path.join(process.cwd(), ".data", "beta-install-sources.json"), path.join("/tmp", "unvibe-beta-install", "beta-install-sources.json")];


describe("betaInstallStats", () => {
  it("parses copy, install, and survey events only", () => {
    assert.equal(parseBetaInstallEvent("copied"), "copied");
    assert.equal(parseBetaInstallEvent("installed"), "installed");
    assert.equal(parseBetaInstallEvent("fetched"), "fetched");
    assert.equal(parseBetaInstallEvent("survey"), "survey");
    assert.equal(parseBetaInstallEvent("hack"), null);
  });

  it("counts copied and installed events on disk", async () => {
    const previousBlob = process.env.BLOB_READ_WRITE_TOKEN;
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await fs.rm(dataFile, { force: true }).catch(() => undefined);
    await fs.rm(tmpDataFile, { force: true }).catch(() => undefined);
    try {
      const afterCopy = await recordBetaInstallEvent("copied");
      const afterInstall = await recordBetaInstallEvent("installed");
      const afterSurvey = await recordBetaInstallEvent("survey");
      assert.equal(afterCopy.copied, 1);
      assert.equal(afterInstall.copied, 1);
      assert.equal(afterInstall.installed, 1);
      assert.equal(afterSurvey.survey, 1);
    } finally {
      if (previousBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = previousBlob;
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      await fs.rm(dataFile, { force: true }).catch(() => undefined);
      await fs.rm(tmpDataFile, { force: true }).catch(() => undefined);
    }
  });
});

describe("install copy sources", () => {
  it("the site event accepts a listed label only with copied, and nothing else in the body", () => {
    assert.deepEqual(parseSiteInstallEvent({ event: "copied", source: "reddit" }), { event: "copied", source: "reddit" });
    assert.deepEqual(parseSiteInstallEvent({ event: "copied" }), { event: "copied", source: null });
    assert.deepEqual(parseSiteInstallEvent({ event: "survey" }), { event: "survey", source: null });
    assert.deepEqual(parseSiteInstallEvent({ event: "installed" }), { event: "installed", source: null }, "the install scripts' body");
    for (const body of [
      { event: "fetched" },
      { event: "survey", source: "reddit" },
      { event: "installed", source: "reddit" },
      { event: "copied", source: "Reddit" },
      { event: "copied", source: "jane@example.com" },
      { event: "copied", source: null },
      { event: "copied", source: "reddit", campaign: "launch" },
      { event: "copied", utm_source: "reddit" },
      null,
      [],
      "copied",
    ]) {
      assert.equal(parseSiteInstallEvent(body), null, JSON.stringify(body));
    }
  });

  it("summarises the last 14 Pacific days per label, largest first, dropping rows outside or unlisted", () => {
    const now = new Date("2026-11-04T20:00:00Z");
    const summary = summarizeCopySources([
      { day: "2026-11-04", source: "reddit", copied: 2 },
      { day: "2026-11-04", source: "direct", copied: 3 },
      { day: "2026-11-03", source: "reddit", copied: 1 },
      { day: "2026-10-01", source: "x", copied: 9 },
      { day: "2026-11-04", source: "jane" as never, copied: 5 },
    ], now);
    assert.equal(summary.daily.length, 14);
    assert.equal(summary.daily[0]!.date, "2026-10-22");
    assert.deepEqual(summary.daily.at(-1), { date: "2026-11-04", sources: [{ source: "direct", copied: 3 }, { source: "reddit", copied: 2 }] });
    assert.deepEqual(summary.daily.at(-2), { date: "2026-11-03", sources: [{ source: "reddit", copied: 1 }] });
    assert.deepEqual(summary.totals, [{ source: "direct", copied: 3 }, { source: "reddit", copied: 3 }]);
  });

  it("a copy with a label adds to today's count for it, and the founder stats carry the breakdown", async () => {
    const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, blob: process.env.BLOB_READ_WRITE_TOKEN };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    for (const file of [...sourcesFiles, dataFile, tmpDataFile]) await fs.rm(file, { force: true }).catch(() => undefined);
    try {
      await recordBetaInstallCopySource("hacker_news");
      await recordBetaInstallCopySource("hacker_news");
      await recordBetaInstallCopySource("direct");
      const stats = await getBetaInstallCounts();
      const today = stats.copiedBySource.daily.at(-1)!;
      assert.equal(today.date, dayKey());
      assert.deepEqual(today.sources, [{ source: "hacker_news", copied: 2 }, { source: "direct", copied: 1 }]);
      assert.deepEqual(stats.copiedBySource.totals, today.sources);
    } finally {
      for (const [name, value] of [["SUPABASE_URL", previous.url], ["SUPABASE_SERVICE_ROLE_KEY", previous.key], ["BLOB_READ_WRITE_TOKEN", previous.blob]] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      for (const file of [...sourcesFiles, dataFile, tmpDataFile]) await fs.rm(file, { force: true }).catch(() => undefined);
    }
  });
});
