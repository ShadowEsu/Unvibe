import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  parseFunnelTrackEvent,
  recordGrowthFunnelEvent,
} from "./growthFunnelStore";

const dataFile = path.join(process.cwd(), ".data", "growth-funnel.json");
const tmpFile = path.join("/tmp", "unvibe-growth-funnel", "growth-funnel.json");

describe("growthFunnelStore", () => {
  it("parses only named funnel events", () => {
    assert.equal(parseFunnelTrackEvent("waitlist_started"), "waitlist_started");
    assert.equal(parseFunnelTrackEvent("hack"), null);
  });

  it("counts a new form start once per person and keeps the audited floor", async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await fs.rm(dataFile, { force: true }).catch(() => undefined);
    await fs.rm(tmpFile, { force: true }).catch(() => undefined);
    try {
      const first = await recordGrowthFunnelEvent("waitlist_started", "person-a");
      const again = await recordGrowthFunnelEvent("waitlist_started", "person-a");
      const second = await recordGrowthFunnelEvent("waitlist_started", "person-b");
      assert.equal(first.formStartedPeople, 38);
      assert.equal(again.formStartedPeople, 38);
      assert.equal(second.formStartedPeople, 39);
      assert.equal(second.formStartedEvents, 45);
      assert.equal(second.startedDidNotFinish, 37);
      const finished = await recordGrowthFunnelEvent("waitlist_completed", "person-a");
      assert.equal(finished.startedDidNotFinish, 36);
      assert.equal(second.source, "live");
    } finally {
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      await fs.rm(dataFile, { force: true }).catch(() => undefined);
      await fs.rm(tmpFile, { force: true }).catch(() => undefined);
    }
  });
});
