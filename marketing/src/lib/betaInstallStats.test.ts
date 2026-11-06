import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseBetaInstallEvent, recordBetaInstallEvent, recordInstallScriptDay } from "./betaInstallStats";

const dataFile = path.join(process.cwd(), ".data", "beta-install.json");
const tmpDataFile = path.join("/tmp", "unvibe-beta-install", "beta-install.json");


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

describe("install script day counts (migration 0012)", () => {
  it("counts the event for the server's Pacific day and passes nothing else to storage", async () => {
    const calls: unknown[][] = [];
    const rpc = async (...args: unknown[]) => {
      calls.push(args);
      return { error: null };
    };
    // 07:30 UTC on 6 Nov is 23:30 PST on 5 Nov.
    assert.equal(await recordInstallScriptDay("mac_fetched", rpc, new Date("2026-11-06T07:30:00Z")), true);
    assert.equal(await recordInstallScriptDay("installed", rpc, new Date("2026-11-06T08:00:00Z")), true);
    assert.deepEqual(calls, [
      ["2026-11-05", "mac_fetched"],
      ["2026-11-06", "installed"],
    ]);
  });

  it("never throws when storage fails, so the script is still served", async () => {
    const now = new Date("2026-11-06T12:00:00Z");
    assert.equal(await recordInstallScriptDay("win_fetched", async () => ({ error: { message: "rpc failed" } }), now), false);
    assert.equal(await recordInstallScriptDay("win_fetched", () => Promise.reject(new Error("network down")), now), false);
    assert.equal(await recordInstallScriptDay("win_fetched", null, now), false);
  });

  it("stops waiting on a call that never answers", async () => {
    const started = Date.now();
    const counted = await recordInstallScriptDay("mac_fetched", () => new Promise(() => {}), new Date(), 30);
    assert.equal(counted, false);
    assert.ok(Date.now() - started < 1000, "waited past the cap");
  });
});
