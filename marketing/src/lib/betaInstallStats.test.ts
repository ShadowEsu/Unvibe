import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { betaInstallScript, betaWindowsInstallScript } from "./betaInstallScript";
import { parseBetaInstallEvent, recordBetaInstallEvent } from "./betaInstallStats";

const dataFile = path.join(process.cwd(), ".data", "beta-install.json");
const tmpDataFile = path.join("/tmp", "unvibe-beta-install", "beta-install.json");

describe("betaInstallScript", () => {
  it("verifies a signed macOS release without clearing quarantine or tracking install telemetry", () => {
    const script = betaInstallScript();
    assert.match(script, /Unvibe-0\.1\.12-beta-arm64-unsigned\.dmg/);
    assert.match(script, /\.sha256/);
    assert.match(script, /shasum -a 256/);
    assert.match(script, /spctl --assess/);
    assert.match(script, /ditto "\$mountPoint\/Unvibe\.app" "\$DEST"/);
    assert.doesNotMatch(script, /xattr|quarantine|install\/event|curl -fsSL.*\| bash/);
  });
});

describe("betaWindowsInstallScript", () => {
  it("verifies the Windows artifact and Authenticode signature before launch", () => {
    const script = betaWindowsInstallScript();
    assert.match(script, /Unvibe-0\.1\.12-win-x64-portable\.exe/);
    assert.match(script, /Invoke-WebRequest/);
    assert.match(script, /Get-FileHash -Algorithm SHA256/);
    assert.match(script, /Get-AuthenticodeSignature/);
    assert.match(script, /Status -ne "Valid"/);
    assert.doesNotMatch(script, /Unblock-File|Run anyway|install\/event|\| iex/);
    assert.doesNotMatch(script, /[—–]/);
  });
});

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
