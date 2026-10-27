import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { POST as postEvent } from "../app/api/stats/event/route";
import { POST as postHit } from "../app/api/stats/hit/route";
import { dayKey, getSiteStats, lastNDates, recordSiteHit } from "./siteStatsStore";

const dataFile = path.join(process.cwd(), ".data", "site-stats.json");

describe("siteStatsStore", () => {
  it("counts views and unique visitors across day week and all time", async () => {
    const previousBlob = process.env.BLOB_READ_WRITE_TOKEN;
    const previousSupabaseUrl = process.env.SUPABASE_URL;
    const previousSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
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
      assert.equal(stats.timezone, "America/Los_Angeles");
      assert.equal(stats.today.date, dayKey());
    } finally {
      if (previousBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = previousBlob;
      if (previousSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousSupabaseUrl;
      if (previousSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousSupabaseKey;
      await fs.rm(dataFile, { force: true }).catch(() => undefined);
    }
  });

  it("uses Pacific calendar dates for day buckets", () => {
    const key = dayKey(new Date("2026-07-21T07:30:00.000Z"));
    assert.equal(key, "2026-07-21");
    const beforeMidnightPt = dayKey(new Date("2026-07-21T06:59:00.000Z"));
    assert.equal(beforeMidnightPt, "2026-07-20");
    const week = lastNDates(3, new Date("2026-07-21T20:00:00.000Z"));
    assert.deepEqual(week, ["2026-07-21", "2026-07-20", "2026-07-19"]);
  });
});

const STORE_ENV = ["BLOB_READ_WRITE_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

/** Runs `body` against the local file store (no Blob, no Supabase), then restores both. */
async function withLocalStore(body: () => Promise<void>): Promise<void> {
  const saved = STORE_ENV.map((name) => [name, process.env[name]] as const);
  for (const name of STORE_ENV) delete process.env[name];
  await fs.rm(dataFile, { force: true });
  try {
    await body();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await fs.rm(dataFile, { force: true });
  }
}

/** Every channel count in the local store file, keyed `day|event|dim1|dim2`. */
async function storedEvents(): Promise<Record<string, number>> {
  const stored: { events?: Record<string, number> } = JSON.parse(await fs.readFile(dataFile, "utf8"));
  return stored.events ?? {};
}

/** Today's channel counts as `event|dim1|dim2` → count. */
async function todaysCounts(): Promise<Record<string, number>> {
  const prefix = `${dayKey()}|`;
  return Object.fromEntries(
    Object.entries(await storedEvents())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, count]) => [key.slice(prefix.length), count]),
  );
}

function post(body: unknown): Request {
  return new Request("https://unvibe.site/api/stats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("site channel counts (site_events_daily, local store)", () => {
  it("counts visit_source once per visitor per day, from the hit's first-touch channel", async () => {
    await withLocalStore(async () => {
      const channel = { source: "instagram", campaign: "profile" };
      assert.equal((await postHit(post({ visitorId: "visitor-a", channel }))).status, 200);
      assert.equal((await postHit(post({ visitorId: "visitor-a", channel }))).status, 200);
      assert.equal((await postHit(post({ visitorId: "visitor-b", channel: { source: "", campaign: "" } }))).status, 200);
      // A hit without a channel (an admin page, or a page cached before this change) counts no source.
      assert.equal((await postHit(post({ visitorId: "visitor-c" }))).status, 200);
      assert.deepEqual(await todaysCounts(), {
        "visit_source|instagram|profile": 1,
        "visit_source|direct|none": 1,
      }, "second visit the same day adds no visit_source count");
      assert.equal((await getSiteStats()).today.views, 4);
    });
  });

  it("stores unknown utm values as other and never a ref code, IP or visitor id", async () => {
    await withLocalStore(async () => {
      await postHit(post({
        visitorId: "visitor-secret-id",
        ref: "ab12cd34",
        ip: "203.0.113.9",
        channel: { source: "  Newsletter ", campaign: "ref=ab12cd34", ref: "ab12cd34", ip: "203.0.113.9" },
      }));
      await recordSiteHit("visitor-d", { event: "visit_source", dim1: "tiktok", dim2: "carousel-one-shortcut" });
      await postEvent(post({ event: "download_cta_clicked", surface: "visitor-secret-id", platform: "203.0.113.9", ref: "ab12cd34" }));
      assert.deepEqual(await todaysCounts(), {
        "visit_source|other|other": 1,
        "visit_source|tiktok|carousel-one-shortcut": 1,
        "download_cta_clicked|other|other": 1,
      }, "unknown utm and dims are stored as other");
      const stored = JSON.stringify(await storedEvents());
      for (const secret of ["ab12cd34", "203.0.113.9", "visitor-secret-id", "newsletter"]) {
        assert.equal(stored.includes(secret), false, `${secret} is not stored in the channel counts`);
      }
    });
  });

  it("counts both download events by surface and platform, and refuses other events", async () => {
    await withLocalStore(async () => {
      for (const body of [
        { event: "download_cta_clicked", surface: "hero", platform: "mac" },
        { event: "download_cta_clicked", surface: "hero", platform: "mac" },
        { event: "download_cta_clicked", surface: "pricing", platform: "other" },
        { event: "release_download_clicked", surface: "home_install", platform: "windows" },
      ]) {
        assert.equal((await postEvent(post(body))).status, 200);
      }
      for (const body of [{ event: "visit_source", surface: "x", platform: "profile" }, { event: "beta_install_copied" }, null]) {
        assert.equal((await postEvent(post(body))).status, 400, `${JSON.stringify(body)} is refused`);
      }
      assert.deepEqual(await todaysCounts(), {
        "download_cta_clicked|hero|mac": 2,
        "download_cta_clicked|pricing|other": 1,
        "release_download_clicked|home_install|windows": 1,
      });
    });
  });
});
